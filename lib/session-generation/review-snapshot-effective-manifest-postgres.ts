import type postgres from 'postgres'

import {
  buildReviewGenerationInputManifest,
  type ReviewGenerationInputManifest,
} from './review-snapshot-generation-input-manifest'
import { projectReviewSqlGenerationInputs } from './review-snapshot-effective-generation-inputs'
import { readReviewSnapshotSqlSourceEvidencePostgres } from './review-snapshot-sql-source-evidence-postgres'
import type { ReviewSnapshotSqlSourceScope } from './review-snapshot-sql-source-evidence'

/**
 * Canonical causal manifest derived from actual, current PostgreSQL facts.
 *
 * Must be invoked on the exact same caller-owned SERIALIZABLE TransactionSql
 * used by the confirmation/CAS and subsequent persistence. Never opens a
 * second connection or transaction. The caller remains responsible for
 * H2/H3/H4A authorization and the final reconciliation write-set check.
 *
 * Calendar facts belong to the SQL source evidence. Today the generator
 * projects macrocycle race metadata, not calendar entries, so calendar-only
 * changes must not create spurious generation_stale results.
 */
export async function readReviewSnapshotEffectiveManifestPostgres(
  tx: postgres.TransactionSql,
  scope: ReviewSnapshotSqlSourceScope,
): Promise<ReviewGenerationInputManifest | null> {
  const source = await readReviewSnapshotSqlSourceEvidencePostgres(tx, scope)
  if (source === null) return null

  const generationInputs = projectReviewSqlGenerationInputs(source)
  return buildReviewGenerationInputManifest({
    groupTrainingPlanId: scope.groupTrainingPlanId,
    generationInputs,
  })
}
