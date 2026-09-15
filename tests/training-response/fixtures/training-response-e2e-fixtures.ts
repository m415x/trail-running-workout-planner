import type {
  AdherenceRuleConfiguration,
  AthleteAdherenceTrend,
  AthleteSystematicVolumeAssessment,
  InternalLoadSignal,
  SystematicVolumeDimension,
  SystematicVolumeSignal,
} from '@/types'

const adherenceRule: AdherenceRuleConfiguration = {
  ruleId: 'plan-adherence', version: 1, minimumConfirmedOutcomes: 1,
  minimumCoveragePercent: 70, minimumComparableSessionsPerDimension: 1,
  minimumComparableWindowsForTrend: 2, trendStableBandPercentagePoints: 5,
}

function volumeSignal(dimension: SystematicVolumeDimension, pattern: SystematicVolumeSignal['pattern'], startDate = '2026-08-01', endDate = '2026-08-07'): SystematicVolumeSignal {
  return {
    athleteId: 'athlete-1', dimension, pattern,
    attention: pattern === 'systematic_excess' ? 'review' : pattern === 'isolated_excess' ? 'info' : 'none',
    ruleVersion: 'systematic-volume-v1',
    current: pattern === 'insufficient_data' ? null : {
      microcycleId: 'micro-2', startDate, endDate, dimension, evaluable: true,
      magnitude: { planned: 40, realized: pattern === 'within_plan' ? 40 : 48, absoluteDelta: pattern === 'within_plan' ? 0 : 8, relativeDeltaPercent: pattern === 'within_plan' ? 0 : 20 },
      coverage: { plannedSessions: 4, comparableSessions: 4, unknownSessions: 0, unplannedRealizedSessions: 0, coverageRatio: 1 },
      context: { microcycleType: 'development', loadFocus: null, competitionPhases: [], competitionIds: [], requiresCoachReview: false },
      insufficientReasons: [], contributingPlannedSessionIds: [], contributingRealizedSessionIds: [], unplannedRealizedSessionIds: [],
    },
    previousEvaluable: null,
    contributingMicrocycleIds: pattern === 'systematic_excess' ? ['micro-1', 'micro-2'] : pattern === 'insufficient_data' ? [] : ['micro-2'],
    insufficientReasons: pattern === 'insufficient_data' ? ['insufficient_microcycle_coverage'] : [],
  }
}

function volumeAssessment(pattern: SystematicVolumeSignal['pattern'], startDate = '2026-08-01', endDate = '2026-08-07'): AthleteSystematicVolumeAssessment {
  return {
    athleteId: 'athlete-1', ruleVersion: 'systematic-volume-v1',
    signals: {
      distanceKm: volumeSignal('distanceKm', pattern, startDate, endDate),
      durationMin: volumeSignal('durationMin', pattern, startDate, endDate),
      elevationGainM: volumeSignal('elevationGainM', pattern, startDate, endDate),
    },
    primaryDimension: pattern === 'insufficient_data' || pattern === 'within_plan' ? null : 'distanceKm',
    attention: pattern === 'systematic_excess' ? 'review' : pattern === 'isolated_excess' ? 'info' : 'none',
  }
}

function internalLoad(state: InternalLoadSignal['state']): InternalLoadSignal {
  return { state, startDate: '2026-08-01', endDate: '2026-08-07', sourceRuleVersion: 'srpe-duration-v1', signalRuleVersion: 'internal-load-signal-v1', insufficientReasons: state === 'insufficient_data' ? ['insufficient_history'] : [] }
}

function adherence(state: AthleteAdherenceTrend['state'], direction: AthleteAdherenceTrend['direction'] = 'stable'): AthleteAdherenceTrend {
  return {
    state, direction: state === 'available' ? direction : null,
    changePercentagePoints: state === 'available' ? (direction === 'declining' ? -12 : 0) : null,
    points: state === 'available' ? [
      { window: { kind: 'week', startDate: '2026-08-01', endDate: '2026-08-07' }, adherencePercent: 80, coveragePercent: 100 },
      { window: { kind: 'week', startDate: '2026-08-08', endDate: '2026-08-14' }, adherencePercent: direction === 'declining' ? 68 : 80, coveragePercent: 100 },
    ] : [],
    rule: adherenceRule,
    ...(state === 'insufficient_data' ? { reasons: ['insufficient_comparable_windows'] as const } : {}),
  } as AthleteAdherenceTrend
}

export const systematicExcess = volumeAssessment('systematic_excess')
export const oldSystematicExcess = volumeAssessment('systematic_excess', '2026-07-01', '2026-07-07')
export const withinPlanVolume = volumeAssessment('within_plan')
export const insufficientVolume = volumeAssessment('insufficient_data')
export const elevatedInternalLoad = internalLoad('recent_load_above_baseline')
export const stableInternalLoad = internalLoad('stable_or_lower')
export const insufficientInternalLoad = internalLoad('insufficient_data')
export const decliningAdherence = adherence('available', 'declining')
export const stableAdherence = adherence('available', 'stable')
export const insufficientAdherence = adherence('insufficient_data')
