import { hasAuthoritativeSessionLink } from '@/lib/readiness/realized-training'
import type { ReadinessPolicy } from '@/types/training/readiness-policy.types'
import type {
  PlanRealMetricName,
  PlannedRealizedLoadComparison,
  PlannedRealizedMetricComparison,
  PlannedRealizedSessionPair,
  ReadinessContinuityIndicator,
} from '@/types/training/readiness-indicator.types'
import type { RecentPreparationSummary } from '@/types/training/readiness.types'

export function evaluateReadinessContinuity(input: {
  readonly summary: RecentPreparationSummary
  readonly policy: ReadinessPolicy
}): ReadinessContinuityIndicator {
  const threshold = input.policy.continuity.minimumActiveBucketRatio
  const observed = input.summary.continuity.activeBucketRatio

  if (observed.state === 'unknown') {
    return {
      status: 'insufficient_data',
      observedActiveBucketRatio: null,
      threshold,
    }
  }

  return {
    status: observed.value < threshold ? 'below_threshold' : 'within_threshold',
    observedActiveBucketRatio: observed.value,
    threshold,
  }
}

function plannedMetric(
  pair: PlannedRealizedSessionPair,
  metric: PlanRealMetricName,
): number | null {
  if (metric === 'distanceKm') return pair.planned.distanceKm
  if (metric === 'durationMin') return pair.planned.durationMin
  return pair.planned.elevationGainM
}

function compareMetric(input: {
  readonly pairs: readonly PlannedRealizedSessionPair[]
  readonly metric: PlanRealMetricName
  readonly policy: ReadinessPolicy
}): PlannedRealizedMetricComparison {
  const comparable = input.pairs.flatMap((pair) => {
    if (!hasAuthoritativeSessionLink(pair.realized)) return []
    if (pair.realized.sessionId !== pair.planned.sessionId) return []

    const planned = plannedMetric(pair, input.metric)
    const realized = pair.realized.metrics[input.metric]
    if (planned === null || planned <= 0 || realized.state !== 'known') return []
    return [{ planned, realized: realized.value }]
  })

  const minimumComparableSessions = input.policy.planVsReal.minimumLinkedSessions
  const threshold = input.policy.planVsReal.relativeDeviationThreshold
  if (comparable.length < minimumComparableSessions) {
    return {
      status: 'insufficient_data',
      metric: input.metric,
      comparableSessions: comparable.length,
      minimumComparableSessions,
      threshold,
    }
  }

  const plannedTotal = comparable.reduce((sum, item) => sum + item.planned, 0)
  const realizedTotal = comparable.reduce((sum, item) => sum + item.realized, 0)
  const relativeDeviation = (realizedTotal - plannedTotal) / plannedTotal
  const absoluteRelativeDeviation = Math.abs(relativeDeviation)

  return {
    status: 'assessed',
    metric: input.metric,
    comparableSessions: comparable.length,
    plannedTotal,
    realizedTotal,
    relativeDeviation,
    absoluteRelativeDeviation,
    threshold,
    exceedsThreshold: absoluteRelativeDeviation >= threshold,
  }
}

export function comparePlannedAndRealizedLoad(input: {
  readonly pairs: readonly PlannedRealizedSessionPair[]
  readonly policy: ReadinessPolicy
}): PlannedRealizedLoadComparison {
  const linkedSessions = new Set(input.pairs
    .filter(({ planned, realized }) => (
      hasAuthoritativeSessionLink(realized)
      && realized.sessionId === planned.sessionId
    ))
    .map(({ planned }) => planned.sessionId)).size

  return {
    linkedSessions,
    distanceKm: compareMetric({ ...input, metric: 'distanceKm' }),
    durationMin: compareMetric({ ...input, metric: 'durationMin' }),
    elevationGainM: compareMetric({ ...input, metric: 'elevationGainM' }),
  }
}
