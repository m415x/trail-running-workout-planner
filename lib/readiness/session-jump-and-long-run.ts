import type { ReadinessPolicy } from '@/types/training/readiness-policy.types'
import type {
  ComparableRealizedSessionSet,
  LongRunConcentrationAssessment,
  LongRunConcentrationMetric,
  PlanRealMetricName,
  PlannedSessionLoad,
  PredictedSessionJumpAssessment,
  PredictedSessionJumpMetric,
} from '@/types/training/readiness-indicator.types'
import type { RealizedTrainingRecord } from '@/types/training/readiness.types'

function performed(record: RealizedTrainingRecord): boolean {
  return record.status === 'completed' || record.status === 'partial'
}

function plannedMetric(planned: PlannedSessionLoad, metric: PlanRealMetricName): number | null {
  if (metric === 'distanceKm') return planned.distanceKm
  if (metric === 'durationMin') return planned.durationMin
  return planned.elevationGainM
}

function thresholdFor(policy: ReadinessPolicy, metric: PlanRealMetricName): number {
  if (metric === 'distanceKm') return policy.predictedSessionJump.distanceIncreaseRatioThreshold
  if (metric === 'durationMin') return policy.predictedSessionJump.durationIncreaseRatioThreshold
  return policy.predictedSessionJump.elevationIncreaseRatioThreshold
}

function assessJumpMetric(input: {
  readonly planned: PlannedSessionLoad
  readonly comparable: readonly RealizedTrainingRecord[]
  readonly metric: PlanRealMetricName
  readonly policy: ReadinessPolicy
}): PredictedSessionJumpMetric {
  const threshold = thresholdFor(input.policy, input.metric)
  const plannedValue = plannedMetric(input.planned, input.metric)
  const values = input.comparable.flatMap((record) => {
    const metric = record.metrics[input.metric]
    return performed(record) && metric.state === 'known' ? [metric.value] : []
  })

  if (plannedValue === null || plannedValue <= 0 || values.length === 0) {
    return {
      status: 'insufficient_data',
      metric: input.metric,
      comparableSessions: values.length,
      threshold,
    }
  }

  const recentReferenceMax = Math.max(...values)
  if (recentReferenceMax <= 0) {
    return {
      status: 'insufficient_data',
      metric: input.metric,
      comparableSessions: values.length,
      threshold,
    }
  }

  const increaseRatio = (plannedValue - recentReferenceMax) / recentReferenceMax
  return {
    status: 'assessed',
    metric: input.metric,
    comparableSessions: values.length,
    plannedValue,
    recentReferenceMax,
    increaseRatio,
    threshold,
    exceedsThreshold: increaseRatio >= threshold,
  }
}

export function assessPredictedSessionJump(input: {
  readonly planned: PlannedSessionLoad
  readonly comparableSessions: ComparableRealizedSessionSet
  readonly policy: ReadinessPolicy
}): PredictedSessionJumpAssessment {
  const recent = [...input.comparableSessions.records]
    .filter(performed)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, input.policy.predictedSessionJump.comparableSessionLookbackCount)

  return {
    comparisonBasis: input.comparableSessions.basis,
    distanceKm: assessJumpMetric({ ...input, comparable: recent, metric: 'distanceKm' }),
    durationMin: assessJumpMetric({ ...input, comparable: recent, metric: 'durationMin' }),
    elevationGainM: assessJumpMetric({ ...input, comparable: recent, metric: 'elevationGainM' }),
  }
}

function concentrationMetric(input: {
  readonly records: readonly RealizedTrainingRecord[]
  readonly metric: 'distanceKm' | 'durationMin'
  readonly threshold: number
  readonly minimumPerformedSessions: number
}): LongRunConcentrationMetric {
  const performedRecords = input.records.filter(performed)
  const values = performedRecords.flatMap((record) => {
    const metric = record.metrics[input.metric]
    return metric.state === 'known' ? [metric.value] : []
  })

  // Concentration cannot be trusted when one performed session has an unknown
  // value for the dimension being evaluated.
  if (
    performedRecords.length < input.minimumPerformedSessions
    || values.length !== performedRecords.length
    || values.length === 0
  ) {
    return {
      status: 'insufficient_data',
      metric: input.metric,
      performedSessions: performedRecords.length,
      minimumPerformedSessions: input.minimumPerformedSessions,
      threshold: input.threshold,
    }
  }

  const weeklyTotal = values.reduce((sum, value) => sum + value, 0)
  if (weeklyTotal <= 0) {
    return {
      status: 'insufficient_data',
      metric: input.metric,
      performedSessions: performedRecords.length,
      minimumPerformedSessions: input.minimumPerformedSessions,
      threshold: input.threshold,
    }
  }

  const longestSessionValue = Math.max(...values)
  const ratio = longestSessionValue / weeklyTotal
  return {
    status: 'assessed',
    metric: input.metric,
    performedSessions: performedRecords.length,
    weeklyTotal,
    longestSessionValue,
    ratio,
    threshold: input.threshold,
    exceedsThreshold: ratio >= input.threshold,
  }
}

export function assessLongRunConcentration(input: {
  readonly weekRecords: readonly RealizedTrainingRecord[]
  readonly policy: ReadinessPolicy
}): LongRunConcentrationAssessment {
  const minimumPerformedSessions = input.policy.longRunConcentration.minimumWeeklyPerformedSessions
  return {
    distance: concentrationMetric({
      records: input.weekRecords,
      metric: 'distanceKm',
      threshold: input.policy.longRunConcentration.maximumVolumeRatio,
      minimumPerformedSessions,
    }),
    duration: concentrationMetric({
      records: input.weekRecords,
      metric: 'durationMin',
      threshold: input.policy.longRunConcentration.maximumDurationRatio,
      minimumPerformedSessions,
    }),
  }
}
