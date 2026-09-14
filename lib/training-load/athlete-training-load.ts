import { buildTrainingLoadEvidenceWindow } from '@/lib/training-load/training-load-evidence'
import { deriveTrainingLoadTrend } from '@/lib/training-load/training-load-trend'
import {
  TRAINING_LOAD_RULE_VERSION,
  type AthleteTrainingLoadState,
  type RealizedTrainingRecord,
} from '@/types'

export interface BuildAthleteTrainingLoadStateInput {
  readonly athleteId: string
  readonly startDate: string
  readonly endDate: string
  readonly records: readonly RealizedTrainingRecord[]
}

export function buildAthleteTrainingLoadState(
  input: BuildAthleteTrainingLoadStateInput,
): AthleteTrainingLoadState {
  const evidence = buildTrainingLoadEvidenceWindow({
    startDate: input.startDate,
    endDate: input.endDate,
    records: input.records,
  })
  const trend = deriveTrainingLoadTrend(evidence.days)
  const latest = trend.length > 0 ? trend[trend.length - 1]! : null

  return {
    athleteId: input.athleteId,
    startDate: input.startDate,
    endDate: input.endDate,
    ruleVersion: TRAINING_LOAD_RULE_VERSION,
    status: latest?.status ?? evidence.status,
    insufficientReasons: evidence.insufficientReasons,
    coverage: evidence.coverage,
    days: evidence.days,
    trend,
    latest,
  }
}
