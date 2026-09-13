import { suppressExpectedReducedLoadAlert } from '@/lib/readiness/evaluation-phase'
import type { ReadinessAssessment, ReadinessAlert } from '@/types/training/readiness-assessment.types'
import type { ReadinessCompetitionTarget, ReadinessEvaluationPhaseResolution } from '@/types/training/readiness-competition.types'
import type {
  LongRunConcentrationAssessment,
  PlannedRealizedLoadComparison,
  PredictedSessionJumpAssessment,
  ReadinessContinuityIndicator,
} from '@/types/training/readiness-indicator.types'
import type { ReadinessPolicy } from '@/types/training/readiness-policy.types'
import type { PreparationSummaryUnit, RecentPreparationSummary } from '@/types/training/readiness.types'

function metricUnit(metric: 'distanceKm' | 'durationMin' | 'elevationGainM'): PreparationSummaryUnit {
  if (metric === 'distanceKm') return 'km'
  if (metric === 'durationMin') return 'min'
  return 'm'
}

function windowPeriod(summary: RecentPreparationSummary) {
  return { startDate: summary.window.startDate, endDate: summary.window.endDate }
}

export function buildReadinessAssessment(input: {
  readonly evaluatedAt: string
  readonly summary: RecentPreparationSummary
  readonly target: ReadinessCompetitionTarget
  readonly phase: ReadinessEvaluationPhaseResolution
  readonly policy: ReadinessPolicy
  readonly continuity?: ReadinessContinuityIndicator | null
  readonly planVsReal?: PlannedRealizedLoadComparison | null
  readonly predictedSessionJump?: PredictedSessionJumpAssessment | null
  readonly longRunConcentration?: LongRunConcentrationAssessment | null
}): ReadinessAssessment {
  if (input.target.scope.teamId !== input.summary.teamId) {
    throw new Error('Readiness target crosses the athlete team scope')
  }
  if (input.phase.competitionDate !== input.target.date) {
    throw new Error('Readiness phase does not belong to the selected competition')
  }

  const limitations = new Set(input.summary.limitations)
  if (input.policy.status === 'draft') limitations.add('draft_policy_thresholds')
  if (input.target.elevationGainM === null) limitations.add('competition_elevation_gain_unknown')

  const base = {
    teamId: input.summary.teamId,
    athleteId: input.summary.athleteId,
    evaluatedAt: input.evaluatedAt,
    target: input.target,
    phase: input.phase,
    summary: input.summary,
    policyVersion: input.policy.version,
    policyStatus: input.policy.status,
    limitations: [...limitations],
  } as const

  if (input.summary.dataStatus === 'insufficient_data') {
    return { ...base, status: 'insufficient_data', alerts: [] }
  }

  const alerts: ReadinessAlert[] = []
  const period = windowPeriod(input.summary)
  const reducedLoadExpected = suppressExpectedReducedLoadAlert({
    phase: input.phase.phase,
    policy: input.policy,
  })

  const longestDistance = input.summary.longRun.longestDistanceKm
  if (longestDistance.state === 'known' && input.target.distanceKm > 0) {
    const ratio = longestDistance.value / input.target.distanceKm
    const threshold = input.policy.competitionExposure.minimumLongestDistanceToRaceRatio
    if (ratio < threshold) {
      alerts.push({
        code: 'competition_distance_exposure_gap',
        cause: 'recent_longest_distance_below_configured_race_ratio',
        dimension: 'distanceKm',
        period,
        evidence: {
          observedValue: longestDistance.value,
          referenceValue: input.target.distanceKm,
          unit: 'km',
        },
        rule: {
          policyVersion: input.policy.version,
          criterion: 'minimum_longest_distance_to_race_ratio',
          threshold,
        },
        limitations: ['configurable_product_criterion_not_readiness_guarantee'],
      })
    }
  }

  const peakElevation = input.summary.longRun.peakElevationGainM
  if (
    input.target.elevationGainM !== null
    && input.target.elevationGainM > 0
    && peakElevation.state === 'known'
  ) {
    const ratio = peakElevation.value / input.target.elevationGainM
    const threshold = input.policy.competitionExposure.minimumPeakElevationToRaceRatio
    if (ratio < threshold) {
      alerts.push({
        code: 'competition_elevation_exposure_gap',
        cause: 'recent_peak_elevation_below_configured_race_ratio',
        dimension: 'elevationGainM',
        period,
        evidence: {
          observedValue: peakElevation.value,
          referenceValue: input.target.elevationGainM,
          unit: 'm',
        },
        rule: {
          policyVersion: input.policy.version,
          criterion: 'minimum_peak_elevation_to_race_ratio',
          threshold,
        },
        limitations: ['configurable_product_criterion_not_readiness_guarantee'],
      })
    }
  }

  if (input.continuity?.status === 'below_threshold' && !reducedLoadExpected) {
    alerts.push({
      code: 'continuity_gap',
      cause: 'active_training_buckets_below_configured_ratio',
      dimension: 'continuity',
      period,
      evidence: {
        observedValue: input.continuity.observedActiveBucketRatio,
        referenceValue: 1,
        unit: 'ratio',
      },
      rule: {
        policyVersion: input.policy.version,
        criterion: 'minimum_active_bucket_ratio',
        threshold: input.continuity.threshold,
      },
      limitations: ['frequency_represents_recorded_activities_only'],
    })
  }

  if (input.planVsReal) {
    for (const metric of ['distanceKm', 'durationMin', 'elevationGainM'] as const) {
      const comparison = input.planVsReal[metric]
      if (comparison.status !== 'assessed' || !comparison.exceedsThreshold) continue
      if (reducedLoadExpected && comparison.relativeDeviation < 0) continue
      alerts.push({
        code: 'planned_realized_deviation',
        cause: comparison.relativeDeviation < 0
          ? 'realized_load_below_prescribed_load'
          : 'realized_load_above_prescribed_load',
        dimension: metric,
        period,
        evidence: {
          observedValue: comparison.realizedTotal,
          referenceValue: comparison.plannedTotal,
          unit: metricUnit(metric),
        },
        rule: {
          policyVersion: input.policy.version,
          criterion: 'plan_real_relative_deviation',
          threshold: comparison.threshold,
        },
        limitations: ['comparison_uses_only_authoritatively_linked_sessions'],
      })
    }
  }

  if (input.predictedSessionJump) {
    for (const metric of ['distanceKm', 'durationMin', 'elevationGainM'] as const) {
      const jump = input.predictedSessionJump[metric]
      if (jump.status !== 'assessed' || !jump.exceedsThreshold) continue
      alerts.push({
        code: 'predicted_session_jump',
        cause: 'planned_session_above_recent_comparable_maximum',
        dimension: metric,
        period,
        evidence: {
          observedValue: jump.plannedValue,
          referenceValue: jump.recentReferenceMax,
          unit: metricUnit(metric),
        },
        rule: {
          policyVersion: input.policy.version,
          criterion: `predicted_${metric}_increase_ratio`,
          threshold: jump.threshold,
        },
        limitations: [`comparison_basis:${input.predictedSessionJump.comparisonBasis}`],
      })
    }
  }

  if (input.longRunConcentration) {
    for (const [dimension, concentration] of [
      ['distanceKm', input.longRunConcentration.distance],
      ['durationMin', input.longRunConcentration.duration],
    ] as const) {
      if (concentration.status !== 'assessed' || !concentration.exceedsThreshold) continue
      alerts.push({
        code: 'long_run_concentration',
        cause: 'longest_session_exceeds_configured_weekly_concentration',
        dimension,
        period,
        evidence: {
          observedValue: concentration.longestSessionValue,
          referenceValue: concentration.weeklyTotal,
          unit: metricUnit(dimension),
        },
        rule: {
          policyVersion: input.policy.version,
          criterion: `${dimension}_weekly_concentration_ratio`,
          threshold: concentration.threshold,
        },
        limitations: ['configurable_product_criterion_not_injury_prediction'],
      })
    }
  }

  return {
    ...base,
    status: 'assessed',
    alerts,
  }
}
