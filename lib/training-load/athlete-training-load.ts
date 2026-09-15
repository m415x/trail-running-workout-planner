import { deriveInternalLoadSignal } from '@/lib/training-load/internal-load-signal'
import { buildTrainingLoadEvidenceWindow } from '@/lib/training-load/training-load-evidence'
import { deriveTrainingLoadTrend } from '@/lib/training-load/training-load-trend'
import {
  TRAINING_LOAD_RULE_CONFIG,
  type AthleteTrainingLoadState,
  type RealizedTrainingRecord,
  type TrainingLoadRuleConfig,
} from '@/types'

export interface BuildAthleteTrainingLoadStateInput {
  readonly athleteId: string
  readonly startDate: string
  readonly endDate: string
  readonly records: readonly RealizedTrainingRecord[]
  readonly rule?: TrainingLoadRuleConfig
}

export function buildAthleteTrainingLoadState(
  input: BuildAthleteTrainingLoadStateInput,
): AthleteTrainingLoadState {
  const rule = input.rule ?? TRAINING_LOAD_RULE_CONFIG
  const evidence = buildTrainingLoadEvidenceWindow({
    startDate: input.startDate,
    endDate: input.endDate,
    records: input.records,
    rule,
  })
  const trend = deriveTrainingLoadTrend(evidence.days, rule)
  const latest = trend.length > 0 ? trend[trend.length - 1]! : null
  const stateWithoutSignal = {
    athleteId: input.athleteId,
    startDate: input.startDate,
    endDate: input.endDate,
    ruleVersion: rule.version,
    status: latest?.status ?? evidence.status,
    insufficientReasons: evidence.insufficientReasons,
    coverage: evidence.coverage,
    days: evidence.days,
    trend,
    latest,
  }

  return {
    ...stateWithoutSignal,
    semanticSignal: deriveInternalLoadSignal(stateWithoutSignal),
  }
}
