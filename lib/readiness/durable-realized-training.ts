import { deduplicateRealizedTrainingRecords } from '@/lib/readiness/realized-training'
import { buildRecentPreparationSummary } from '@/lib/readiness/recent-preparation-summary'
import { listRealizedTrainingRecordsForAthlete } from '@/lib/realized-training/realized-training-repository'
import type {
  ReadinessDataSufficiencyPolicy,
  RecentPreparationSummary,
} from '@/types/training/readiness.types'

export interface DurableRecentPreparationResult {
  readonly summary: RecentPreparationSummary
  readonly duplicateRecordIds: readonly string[]
  readonly ambiguousIdentityRecordIds: readonly string[]
}

/**
 * Durable H12/readiness entry point for recent preparation.
 *
 * The database-backed realized-training repository is the only source of
 * performed evidence. Callers must not substitute planned sessions, component
 * state, or an in-memory "completed" flag. Stable-identity deduplication runs
 * before sufficiency and aggregation so duplicate imported activities cannot
 * inflate preparation metrics.
 */
export function buildDurableRecentPreparation(input: {
  readonly teamId: string
  readonly athleteId: string
  readonly endDate: string
  readonly policy: ReadinessDataSufficiencyPolicy
}): DurableRecentPreparationResult {
  const persisted = listRealizedTrainingRecordsForAthlete(input.athleteId, input.teamId)
  const deduplicated = deduplicateRealizedTrainingRecords(persisted)

  return {
    summary: buildRecentPreparationSummary({
      records: deduplicated.records,
      teamId: input.teamId,
      athleteId: input.athleteId,
      endDate: input.endDate,
      policy: input.policy,
    }),
    duplicateRecordIds: deduplicated.duplicateRecordIds,
    ambiguousIdentityRecordIds: deduplicated.ambiguousRecordIds,
  }
}
