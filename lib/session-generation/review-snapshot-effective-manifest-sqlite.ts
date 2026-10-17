import type Database from 'better-sqlite3'

import {
  buildReviewGenerationInputManifest,
  type ReviewGenerationInputManifest,
} from './review-snapshot-generation-input-manifest'
import { projectReviewSqlGenerationInputs } from './review-snapshot-effective-generation-inputs'
import {
  readReviewSnapshotSqlSourceEvidence,
  type ReviewSnapshotSqlSourceScope,
} from './review-snapshot-sql-source-evidence'

/**
 * Builds the canonical generation manifest from freshly persisted, scoped
 * SQL facts. It is NOT an independent digest of raw SQL rows: only the
 * effective SessionGenerationInput values are hashed.
 *
 * An absent or deleted Plan is represented by null; invalid or incomplete
 * generation inputs reject rather than yielding a trusted empty manifest.
 *
 * SQL ownership predicates are not actor authorization. A server caller must
 * separately enforce H2/H3/H4A access and reauthorize around CREATE.
 */
export function readReviewSnapshotEffectiveManifestSqlite(
  sqlite: Database.Database,
  scope: ReviewSnapshotSqlSourceScope,
): ReviewGenerationInputManifest | null {
  // Hold one consistent SQLite snapshot through reading, projection and
  // hashing; do not mix separate revisions between these operations.
  return sqlite.transaction(() => {
    const source = readReviewSnapshotSqlSourceEvidence(sqlite, scope)
    if (source === null) return null

    const generationInputs = projectReviewSqlGenerationInputs(source)
    return buildReviewGenerationInputManifest({
      groupTrainingPlanId: scope.groupTrainingPlanId,
      generationInputs,
    })
  }).deferred()
}
