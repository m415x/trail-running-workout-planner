import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildAthleteTrainingResponseReview } from '@/lib/training-response/athlete-training-response-review'
import type {
  AdherenceRuleConfiguration,
  AthleteAdherenceTrend,
  AthleteSystematicVolumeAssessment,
  InternalLoadSignal,
  SystematicVolumeDimension,
  SystematicVolumeSignal,
} from '@/types'

const adherenceRule: AdherenceRuleConfiguration = {
  ruleId: 'plan-adherence',
  version: 1,
  minimumConfirmedOutcomes: 1,
  minimumCoveragePercent: 70,
  minimumComparableSessionsPerDimension: 1,
  minimumComparableWindowsForTrend: 2,
  trendStableBandPercentagePoints: 5,
}

function volumeSignal(
  dimension: SystematicVolumeDimension,
  pattern: SystematicVolumeSignal['pattern'],
  startDate = '2026-08-01',
  endDate = '2026-08-07',
): SystematicVolumeSignal {
  return {
    athleteId: 'athlete-1', dimension, pattern,
    attention: pattern === 'systematic_excess' ? 'review' : pattern === 'isolated_excess' ? 'info' : 'none',
    ruleVersion: 'systematic-volume-v1',
    current: pattern === 'insufficient_data' ? null : {
      microcycleId: 'micro-2', startDate, endDate, dimension, evaluable: true,
      magnitude: {
        planned: 40, realized: pattern === 'within_plan' ? 40 : 48,
        absoluteDelta: pattern === 'within_plan' ? 0 : 8,
        relativeDeltaPercent: pattern === 'within_plan' ? 0 : 20,
      },
      coverage: {
        plannedSessions: 4, comparableSessions: 4, unknownSessions: 0,
        unplannedRealizedSessions: 0, coverageRatio: 1,
      },
      context: {
        microcycleType: 'development', loadFocus: null, competitionPhases: [],
        competitionIds: [], requiresCoachReview: false,
      },
      insufficientReasons: [], contributingPlannedSessionIds: [],
      contributingRealizedSessionIds: [], unplannedRealizedSessionIds: [],
    },
    previousEvaluable: null,
    contributingMicrocycleIds: pattern === 'systematic_excess' ? ['micro-1', 'micro-2'] : ['micro-2'],
    insufficientReasons: pattern === 'insufficient_data' ? ['insufficient_microcycle_coverage'] : [],
  }
}

function volumeAssessment(pattern: SystematicVolumeSignal['pattern']): AthleteSystematicVolumeAssessment {
  return {
    athleteId: 'athlete-1', ruleVersion: 'systematic-volume-v1',
    signals: {
      distanceKm: volumeSignal('distanceKm', pattern),
      durationMin: volumeSignal('durationMin', pattern),
      elevationGainM: volumeSignal('elevationGainM', pattern),
    },
    primaryDimension: pattern === 'insufficient_data' || pattern === 'within_plan' ? null : 'distanceKm',
    attention: pattern === 'systematic_excess' ? 'review' : pattern === 'isolated_excess' ? 'info' : 'none',
  }
}

function internalLoad(state: InternalLoadSignal['state']): InternalLoadSignal {
  return {
    state, startDate: '2026-08-01', endDate: '2026-08-07',
    sourceRuleVersion: 'srpe-duration-v1', signalRuleVersion: 'internal-load-signal-v1',
    insufficientReasons: state === 'insufficient_data' ? ['insufficient_history'] : [],
  }
}

function adherence(
  state: AthleteAdherenceTrend['state'] = 'available',
  direction: AthleteAdherenceTrend['direction'] = 'declining',
): AthleteAdherenceTrend {
  return {
    state,
    direction: state === 'available' ? direction : null,
    changePercentagePoints: state === 'available' ? -12 : null,
    points: state === 'available' ? [
      { window: { kind: 'week', startDate: '2026-08-01', endDate: '2026-08-07' }, adherencePercent: 80, coveragePercent: 100 },
      { window: { kind: 'week', startDate: '2026-08-08', endDate: '2026-08-14' }, adherencePercent: 68, coveragePercent: 100 },
    ] : [],
    rule: adherenceRule,
    ...(state === 'insufficient_data' ? { reasons: ['insufficient_comparable_windows'] as const } : {}),
  } as AthleteAdherenceTrend
}

describe('integrated athlete training response review', () => {
  it('produces priority from compatible independent evidence and preserves adherence as context', () => {
    const result = buildAthleteTrainingResponseReview({
      systematicVolume: volumeAssessment('systematic_excess'),
      internalLoad: internalLoad('recent_load_above_baseline'), adherence: adherence(),
    })
    assert.equal(result.attention, 'priority')
    assert.equal(result.temporalCompatibility, 'compatible')
    assert.deepEqual(result.contributors.map(({ domain }) => domain), ['systematic_volume', 'internal_load', 'adherence'])
    assert.equal(result.contributors.find(({ domain }) => domain === 'adherence')?.role, 'context')
  })

  it('preserves known review evidence when another domain is insufficient', () => {
    const result = buildAthleteTrainingResponseReview({
      systematicVolume: volumeAssessment('systematic_excess'),
      internalLoad: internalLoad('insufficient_data'), adherence: adherence('insufficient_data'),
    })
    assert.equal(result.attention, 'review')
    assert.ok(result.limitations.includes('internal_load_insufficient_data'))
    assert.ok(result.limitations.includes('adherence_insufficient_data'))
  })

  it('does not let declining adherence elevate otherwise normal evidence', () => {
    const result = buildAthleteTrainingResponseReview({
      systematicVolume: volumeAssessment('within_plan'),
      internalLoad: internalLoad('stable_or_lower'), adherence: adherence('available', 'declining'),
    })
    assert.equal(result.attention, 'none')
    assert.equal(result.contributors.length, 1)
    assert.equal(result.contributors[0]?.domain, 'adherence')
    assert.equal(result.contributors[0]?.role, 'context')
  })
})
