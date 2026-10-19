import type Database from 'better-sqlite3'

import { buildGenerationExplanation, type GenerationExplanation } from './generation-explanation'
import { generateWeeklySessionProposals } from './session-proposal-generator'
import { groupSharedSessionEvents } from './shared-session-events'
import { projectReviewSqlGenerationInputs } from './review-snapshot-effective-generation-inputs'
import { buildReviewGenerationInputManifest, type ReviewGenerationInputManifest } from './review-snapshot-generation-input-manifest'
import { readReviewSnapshotSqlSourceEvidence, type ReviewSnapshotSqlSourceScope } from './review-snapshot-sql-source-evidence'
import type { SharedSessionGenerationResult } from '@/types/training/session-generation.types'

interface SqliteGenerationScope extends ReviewSnapshotSqlSourceScope {
  readonly planningCohortId: string | null
}

export interface GeneratedReviewSnapshotSqlite {
  readonly proposal: SharedSessionGenerationResult
  readonly generationExplanations: Record<string, GenerationExplanation>
  readonly sourceManifest: ReviewGenerationInputManifest
  readonly schemaVersion: string
  readonly generatorVersion: string
  readonly sessionCount: number
  readonly microcycleCount: number
}

/**
 * One trusted SQLite read snapshot supplies all effective generator inputs,
 * proposed sessions, causal explanations and their canonical manifest.
 * It never writes a review snapshot or grants H2/H3/H4A access.
 *
 * The authorized CREATE boundary must still reauthorize after generation,
 * re-read current SQL facts and reject changes before allocating evidence.
 */
export function generateReviewSnapshotFromEffectiveSqlite(
  sqlite: Database.Database,
  scope: SqliteGenerationScope,
): GeneratedReviewSnapshotSqlite {
  return sqlite.transaction((): GeneratedReviewSnapshotSqlite => {
    const facts = readReviewSnapshotSqlSourceEvidence(sqlite, scope)
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
    for (const { input, result } of runs) {
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

    const microcycleIds = new Set(
      proposal.events.flatMap(event =>
        event.prescriptions.map(item => item.prescription.microcycleId)),
    )
    return {
      proposal,
      generationExplanations,
      sourceManifest,
      schemaVersion: '1',
      generatorVersion: '1',
      sessionCount: proposal.events.length,
      microcycleCount: microcycleIds.size,
    }
  }).deferred()
}
