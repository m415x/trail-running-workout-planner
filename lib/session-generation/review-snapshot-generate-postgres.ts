import type postgres from 'postgres'

import { buildGenerationExplanation, type GenerationExplanation } from './generation-explanation'
import { generateWeeklySessionProposals } from './session-proposal-generator'
import { groupSharedSessionEvents } from './shared-session-events'
import { projectReviewSqlGenerationInputs } from './review-snapshot-effective-generation-inputs'
import { buildReviewGenerationInputManifest } from './review-snapshot-generation-input-manifest'
import { readReviewSnapshotSqlSourceEvidencePostgres } from './review-snapshot-sql-source-evidence-postgres'
import type { SharedSessionGenerationResult } from '@/types/training/session-generation.types'

interface Scope {
  readonly groupTrainingPlanId: string
  readonly teamId: string
  readonly groupId: string
  readonly planningCohortId: string | null
}

export interface GeneratedReviewSnapshotPostgres {
  readonly proposal: SharedSessionGenerationResult
  readonly generationExplanations: Record<string, GenerationExplanation>
  readonly sourceManifest: ReturnType<typeof buildReviewGenerationInputManifest>
  readonly schemaVersion: '1'
  readonly generatorVersion: '1'
  readonly sessionCount: number
  readonly microcycleCount: number
}

/**
 * Postgres-backed server generation: same pure deterministic algorithm as
 * SQLite CREATE. The caller owns a SERIALIZABLE transaction and must enforce
 * H2/H3/H4A before calling this reader. It does not allocate a snapshot.
 */
export async function generateReviewSnapshotFromEffectivePostgres(
  tx: postgres.TransactionSql,
  scope: Scope,
): Promise<GeneratedReviewSnapshotPostgres> {
  const facts = await readReviewSnapshotSqlSourceEvidencePostgres(tx, scope)
  if (!facts) throw new Error('Invalid or denied generation source scope')
  const inputs = projectReviewSqlGenerationInputs(facts)
  const sourceManifest = buildReviewGenerationInputManifest({
    groupTrainingPlanId: scope.groupTrainingPlanId,
    generationInputs: inputs,
  })
  const runs = inputs.map(input => ({
    input,
    result: generateWeeklySessionProposals(input),
  }))
  const proposal = groupSharedSessionEvents(runs.map(run => run.result))
  const generationExplanations: Record<string, GenerationExplanation> = {}
  for (const {input, result} of runs) {
    for (const generated of result.proposals) {
      generationExplanations[generated.generationKey] = buildGenerationExplanation({
        input,
        result,
        sharedGeneration: proposal,
        generationKey: generated.generationKey,
        planningCohortId: scope.planningCohortId,
      })
    }
  }
  const microcycleIds = new Set(proposal.events.flatMap(event =>
    event.prescriptions.map(item => item.prescription.microcycleId)))
  return {
    proposal,
    generationExplanations,
    sourceManifest,
    schemaVersion: '1',
    generatorVersion: '1',
    sessionCount: proposal.events.length,
    microcycleCount: microcycleIds.size,
  }
}
