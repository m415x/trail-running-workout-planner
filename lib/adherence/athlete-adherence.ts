import type {
  AdherenceDimensionResult,
  AdherenceFrequencyResult,
  AdherenceInsufficientDataReason,
  AdherenceRuleConfiguration,
  AthleteAdherence,
  AthletePlanRealComparison,
  TrainingComparisonMetricName,
} from '@/types'

export const ADHERENCE_RULES: Readonly<Record<number, AdherenceRuleConfiguration>> = {
  1: {
    ruleId: 'plan-adherence',
    version: 1,
    minimumConfirmedOutcomes: 2,
    minimumCoveragePercent: 60,
    minimumComparableSessionsPerDimension: 2,
    minimumComparableWindowsForTrend: 3,
    trendStableBandPercentagePoints: 5,
  },
}

export const DEFAULT_ADHERENCE_RULE = ADHERENCE_RULES[1]

const METRICS: readonly TrainingComparisonMetricName[] = [
  'distanceKm',
  'durationMin',
  'elevationGainM',
  'intensity',
]

function percentage(numerator: number, denominator: number) {
  if (denominator === 0) return null
  return (numerator / denominator) * 100
}

function frequencyReasons(
  eligiblePlannedSessions: number,
  confirmedOutcomeSessions: number,
  coveragePercent: number | null,
  hasPlanningLimitations: boolean,
  rule: AdherenceRuleConfiguration,
) {
  const reasons: AdherenceInsufficientDataReason[] = []
  if (eligiblePlannedSessions === 0) reasons.push('no_eligible_planned_sessions')
  if (confirmedOutcomeSessions < rule.minimumConfirmedOutcomes) reasons.push('insufficient_confirmed_outcomes')
  if (coveragePercent !== null && coveragePercent < rule.minimumCoveragePercent) reasons.push('insufficient_coverage')
  if (hasPlanningLimitations) reasons.push('planning_resolution_limited')
  return reasons
}

function buildDimension(
  comparison: AthletePlanRealComparison,
  metric: TrainingComparisonMetricName,
  rule: AdherenceRuleConfiguration,
): AdherenceDimensionResult {
  const plannedItems = comparison.items.filter(item => item.kind === 'planned_session')
  let matchedSessions = 0
  let deviationSessions = 0
  let notEvaluatedSessions = 0

  for (const item of plannedItems) {
    const metricComparison = item.metrics.find(candidate => candidate.name === metric)
    if (!metricComparison || metricComparison.evaluation.state === 'not_evaluated') {
      notEvaluatedSessions += 1
      continue
    }

    if (metricComparison.evaluation.state === 'matched') matchedSessions += 1
    else deviationSessions += 1
  }

  const comparableSessions = matchedSessions + deviationSessions
  const counts = {
    comparableSessions,
    matchedSessions,
    deviationSessions,
    notEvaluatedSessions,
  }

  const reasons: AdherenceInsufficientDataReason[] = []
  if (comparableSessions < rule.minimumComparableSessionsPerDimension) {
    reasons.push('insufficient_confirmed_outcomes')
  }
  if (comparison.planningLimitations.length > 0) reasons.push('planning_resolution_limited')

  if (reasons.length > 0) {
    return {
      metric,
      state: 'insufficient_data',
      counts,
      adherencePercent: null,
      reasons,
    }
  }

  return {
    metric,
    state: 'available',
    counts,
    adherencePercent: percentage(matchedSessions, comparableSessions) ?? 0,
  }
}

/**
 * Derives adherence exclusively from the explainable KAN-259 comparison.
 * Unknown outcomes remain visible in coverage and never become failures.
 */
export function deriveAthleteAdherence(
  comparison: AthletePlanRealComparison,
  rule: AdherenceRuleConfiguration = DEFAULT_ADHERENCE_RULE,
): AthleteAdherence {
  const plannedItems = comparison.items.filter(item => item.kind === 'planned_session')
  const unplannedRealizedSessions = comparison.items.filter(item => item.kind === 'unplanned_realized').length
  const confirmedCompleted = plannedItems.filter(item => item.state === 'matched' || item.state === 'deviation').length
  const confirmedNotCompleted = plannedItems.filter(item => item.state === 'known_not_completed').length
  const unknownSessions = plannedItems.filter(item => item.state === 'unknown').length
  const eligiblePlannedSessions = plannedItems.length
  const confirmedOutcomeSessions = confirmedCompleted + confirmedNotCompleted
  const coveragePercent = percentage(confirmedOutcomeSessions, eligiblePlannedSessions)

  const counts = {
    confirmedCompleted,
    confirmedNotCompleted,
    denominator: confirmedOutcomeSessions,
  }
  const reasons = frequencyReasons(
    eligiblePlannedSessions,
    confirmedOutcomeSessions,
    coveragePercent,
    comparison.planningLimitations.length > 0,
    rule,
  )

  const frequency: AdherenceFrequencyResult = reasons.length > 0
    ? {
        state: 'insufficient_data',
        counts,
        adherencePercent: null,
        reasons,
      }
    : {
        state: 'available',
        counts,
        adherencePercent: percentage(confirmedCompleted, confirmedOutcomeSessions) ?? 0,
      }

  return {
    teamId: comparison.teamId,
    athleteId: comparison.athleteId,
    window: comparison.window,
    rule,
    coverage: {
      eligiblePlannedSessions,
      confirmedOutcomeSessions,
      unknownSessions,
      unplannedRealizedSessions,
      coveragePercent,
    },
    frequency,
    dimensions: METRICS.map(metric => buildDimension(comparison, metric, rule)),
    limitations: comparison.planningLimitations.map(limitation => (
      `${limitation.date}:${limitation.status}:${limitation.reason}`
    )),
  }
}
