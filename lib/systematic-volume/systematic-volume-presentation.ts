import type {
  AthleteSystematicVolumeAssessment,
  SystematicVolumeAttention,
  SystematicVolumeDimension,
  SystematicVolumePattern,
  SystematicVolumePlanningContext,
} from '@/types'

export type SystematicVolumeSummaryCode = 'ok' | 'info' | 'review' | 'unknown'

export interface SystematicVolumeCompactSummary {
  readonly code: SystematicVolumeSummaryCode
  readonly attention: SystematicVolumeAttention
  readonly pattern: SystematicVolumePattern
  readonly dimension: SystematicVolumeDimension | null
  readonly relativeDeltaPercent: number | null
  readonly absoluteDelta: number | null
  readonly ruleVersion: AthleteSystematicVolumeAssessment['ruleVersion']
}

export interface SystematicVolumeDetailProjection {
  readonly athleteId: string
  readonly dimension: SystematicVolumeDimension
  readonly attention: SystematicVolumeAttention
  readonly pattern: SystematicVolumePattern
  readonly planned: number | null
  readonly realized: number | null
  readonly absoluteDelta: number | null
  readonly relativeDeltaPercent: number | null
  readonly startDate: string | null
  readonly endDate: string | null
  readonly coverageRatio: number | null
  readonly comparableSessions: number
  readonly plannedSessions: number
  readonly unplannedRealizedSessions: number
  readonly context: SystematicVolumePlanningContext | null
  readonly insufficientReasons: readonly string[]
  readonly contributingMicrocycleIds: readonly string[]
  readonly ruleVersion: AthleteSystematicVolumeAssessment['ruleVersion']
}

function summaryCode(
  pattern: SystematicVolumePattern,
  attention: SystematicVolumeAttention,
): SystematicVolumeSummaryCode {
  if (pattern === 'insufficient_data') return 'unknown'
  if (attention === 'review' || attention === 'priority') return 'review'
  if (attention === 'info') return 'info'
  return 'ok'
}

export function buildSystematicVolumeCompactSummary(
  assessment: AthleteSystematicVolumeAssessment,
): SystematicVolumeCompactSummary {
  const dimension = assessment.primaryDimension
  const signal = dimension ? assessment.signals[dimension] : null
  const current = signal?.current ?? null

  if (!signal) {
    const hasInsufficientData = Object.values(assessment.signals).some(
      candidate => candidate.pattern === 'insufficient_data',
    )

    return {
      code: hasInsufficientData ? 'unknown' : 'ok',
      attention: 'none',
      pattern: hasInsufficientData ? 'insufficient_data' : 'within_plan',
      dimension: null,
      relativeDeltaPercent: null,
      absoluteDelta: null,
      ruleVersion: assessment.ruleVersion,
    }
  }

  return {
    code: summaryCode(signal.pattern, signal.attention),
    attention: signal.attention,
    pattern: signal.pattern,
    dimension,
    relativeDeltaPercent: current?.magnitude?.relativeDeltaPercent ?? null,
    absoluteDelta: current?.magnitude?.absoluteDelta ?? null,
    ruleVersion: assessment.ruleVersion,
  }
}

export function buildSystematicVolumeDetailProjection(
  assessment: AthleteSystematicVolumeAssessment,
  dimension: SystematicVolumeDimension,
): SystematicVolumeDetailProjection {
  const signal = assessment.signals[dimension]
  const current = signal.current
  const magnitude = current?.magnitude ?? null

  return {
    athleteId: assessment.athleteId,
    dimension,
    attention: signal.attention,
    pattern: signal.pattern,
    planned: magnitude?.planned ?? null,
    realized: magnitude?.realized ?? null,
    absoluteDelta: magnitude?.absoluteDelta ?? null,
    relativeDeltaPercent: magnitude?.relativeDeltaPercent ?? null,
    startDate: current?.startDate ?? null,
    endDate: current?.endDate ?? null,
    coverageRatio: current?.coverage.coverageRatio ?? null,
    comparableSessions: current?.coverage.comparableSessions ?? 0,
    plannedSessions: current?.coverage.plannedSessions ?? 0,
    unplannedRealizedSessions: current?.coverage.unplannedRealizedSessions ?? 0,
    context: current?.context ?? null,
    insufficientReasons: signal.insufficientReasons,
    contributingMicrocycleIds: signal.contributingMicrocycleIds,
    ruleVersion: signal.ruleVersion,
  }
}
