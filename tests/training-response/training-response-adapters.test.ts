import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  adaptAdherenceTrend,
  adaptInternalLoadSignal,
  adaptSystematicVolumeAssessment,
} from '@/lib/training-response/training-response-adapters'
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
): SystematicVolumeSignal {
  return {
    athleteId: 'athlete-1',
    dimension,
    pattern,
    attention: pattern === 'systematic_excess' ? 'review' : pattern === 'isolated_excess' ? 'info' : 'none',
    ruleVersion: 'systematic-volume-v1',
    current: pattern === 'insufficient_data' ? null : {
      microcycleId: 'micro-2',
      startDate: '2026-08-01',
      endDate: '2026-08-07',
      dimension,
      evaluable: true,
      magnitude: pattern === 'within_plan' ? {
        planned: 40, realized: 40, absoluteDelta: 0, relativeDeltaPercent: 0,
      } : {
        planned: 40, realized: 48, absoluteDelta: 8, relativeDeltaPercent: 20,
      },
      coverage: {
        plannedSessions: 4, comparableSessions: 4, unknownSessions: 0,
        unplannedRealizedSessions: 0, coverageRatio: 1,
      },
      context: {
        microcycleType: 'load', loadFocus: null, competitionPhases: [],
        competitionIds: [], requiresCoachReview: false,
      },
      insufficientReasons: [],
      contributingPlannedSessionIds: [],
      contributingRealizedSessionIds: [],
      unplannedRealizedSessionIds: [],
    },
    previousEvaluable: null,
    contributingMicrocycleIds: pattern === 'systematic_excess' ? ['micro-1', 'micro-2'] : ['micro-2'],
    insufficientReasons: pattern === 'insufficient_data' ? ['insufficient_microcycle_coverage'] : [],
  }
}

function volumeAssessment(): AthleteSystematicVolumeAssessment {
  return {
    athleteId: 'athlete-1', ruleVersion: 'systematic-volume-v1',
    signals: {
      distanceKm: volumeSignal('distanceKm', 'systematic_excess'),
      durationMin: volumeSignal('durationMin', 'systematic_excess'),
      elevationGainM: volumeSignal('elevationGainM', 'within_plan'),
    },
    primaryDimension: 'distanceKm', attention: 'review',
  }
}

describe('training response source adapters', () => {
  it('collapses multiple systematic-volume dimensions into one domain contributor', () => {
    const adapted = adaptSystematicVolumeAssessment(volumeAssessment())
    assert.equal(adapted.contributors.length, 1)
    assert.equal(adapted.contributors[0]?.domain, 'systematic_volume')
    assert.equal(adapted.contributors[0]?.signal, 'systematic_excess')
    assert.equal(adapted.contributors[0]?.role, 'evidence')
    assert.deepEqual(adapted.contributors[0]?.evidenceWindow, { startDate: '2026-08-01', endDate: '2026-08-07' })
  })

  it('preserves systematic-volume insufficient data as a limitation', () => {
    const assessment = volumeAssessment()
    const adapted = adaptSystematicVolumeAssessment({
      ...assessment,
      signals: {
        distanceKm: volumeSignal('distanceKm', 'insufficient_data'),
        durationMin: volumeSignal('durationMin', 'insufficient_data'),
        elevationGainM: volumeSignal('elevationGainM', 'insufficient_data'),
      },
      primaryDimension: null, attention: 'none',
    })
    assert.deepEqual(adapted.contributors, [])
    assert.ok(adapted.limitations.includes('systematic_volume_insufficient_data'))
  })

  it('maps the semantic internal-load signal without reinterpreting load balance', () => {
    const signal: InternalLoadSignal = {
      state: 'recent_load_above_baseline', startDate: '2026-08-01', endDate: '2026-08-07',
      sourceRuleVersion: 'srpe-duration-v1', signalRuleVersion: 'internal-load-signal-v1', insufficientReasons: [],
    }
    const adapted = adaptInternalLoadSignal(signal)
    assert.equal(adapted.contributors[0]?.signal, 'recent_load_above_baseline')
    assert.equal(adapted.contributors[0]?.sourceRuleVersion, 'internal-load-signal-v1')
    assert.deepEqual(adapted.limitations, [])
  })

  it('preserves internal-load insufficient data as a limitation', () => {
    const signal: InternalLoadSignal = {
      state: 'insufficient_data', startDate: '2026-08-01', endDate: '2026-08-07',
      sourceRuleVersion: 'srpe-duration-v1', signalRuleVersion: 'internal-load-signal-v1',
      insufficientReasons: ['insufficient_history'],
    }
    const adapted = adaptInternalLoadSignal(signal)
    assert.deepEqual(adapted.contributors, [])
    assert.deepEqual(adapted.limitations, ['internal_load_insufficient_data'])
  })

  it('maps declining adherence as context only', () => {
    const trend: AthleteAdherenceTrend = {
      state: 'available', direction: 'declining', changePercentagePoints: -12,
      points: [
        { window: { kind: 'week', startDate: '2026-08-01', endDate: '2026-08-07' }, adherencePercent: 80, coveragePercent: 100 },
        { window: { kind: 'week', startDate: '2026-08-08', endDate: '2026-08-14' }, adherencePercent: 68, coveragePercent: 100 },
      ],
      rule: adherenceRule,
    }
    const adapted = adaptAdherenceTrend(trend)
    assert.equal(adapted.contributors[0]?.domain, 'adherence')
    assert.equal(adapted.contributors[0]?.signal, 'declining')
    assert.equal(adapted.contributors[0]?.role, 'context')
    assert.equal(adapted.contributors[0]?.sourceRuleVersion, 'plan-adherence-v1')
    assert.deepEqual(adapted.contributors[0]?.evidenceWindow, { startDate: '2026-08-01', endDate: '2026-08-14' })
  })

  it('preserves insufficient adherence as a limitation instead of negative evidence', () => {
    const trend: AthleteAdherenceTrend = {
      state: 'insufficient_data', direction: null, changePercentagePoints: null,
      points: [], rule: adherenceRule, reasons: ['insufficient_comparable_windows'],
    }
    const adapted = adaptAdherenceTrend(trend)
    assert.deepEqual(adapted.contributors, [])
    assert.deepEqual(adapted.limitations, ['adherence_insufficient_data'])
  })
})
