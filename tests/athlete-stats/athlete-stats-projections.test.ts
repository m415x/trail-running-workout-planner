import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  projectAthleteStatsDetails,
  projectAthleteStatsSummary,
} from '@/lib/athlete-stats/athlete-stats-projections'
import type { RealizedTrainingEvolution } from '@/lib/analytics/training/training-evolution'
import type { RealizedTrainingSummary } from '@/lib/analytics/training/training-analytics'
import type { LoadAnalyticsProjection } from '@/lib/analytics/load/load-analytics'
import type { AdherenceAnalyticsProjection } from '@/lib/analytics/adherence/adherence-analytics'
import type { CompetitionAnalyticsProjection } from '@/lib/analytics/competition/competition-analytics'

const comparison = (currentValue: number, previousValue: number) => ({
  state: 'available' as const,
  currentValue,
  previousValue,
  absoluteDelta: currentValue - previousValue,
  relativeDeltaPercent: previousValue === 0 ? null : ((currentValue - previousValue) / previousValue) * 100,
  direction: currentValue > previousValue ? 'increasing' as const : currentValue < previousValue ? 'decreasing' as const : 'stable' as const,
})

const unknownComparison = {
  state: 'not_evaluable' as const,
  currentValue: null,
  previousValue: null,
  absoluteDelta: null,
  relativeDeltaPercent: null,
  direction: 'unknown' as const,
  reason: 'current_unknown' as const,
}

const training: RealizedTrainingSummary = {
  frequency: { state: 'available', value: 4 },
  distance: { state: 'available', value: 42, knownRecords: 4, observedRecords: 4 },
  duration: { state: 'available', value: 360, knownRecords: 4, observedRecords: 4 },
  elevation: { state: 'available', value: 1800, knownRecords: 4, observedRecords: 4 },
}

const evolution: RealizedTrainingEvolution = {
  frequency: comparison(4, 3),
  distance: comparison(42, 35),
  duration: comparison(360, 330),
  elevation: comparison(1800, 1700),
}

const load: LoadAnalyticsProjection = {
  state: 'available',
  startDate: '2026-09-01',
  endDate: '2026-09-14',
  ruleVersion: 'srpe-duration-v1',
  coverageRatio: 0.9,
  latest: {
    date: '2026-09-14', dailyLoadAu: 300, shortTermLoadAu: 280,
    longTermLoadAu: 250, loadBalanceAu: 30, status: 'available',
  },
  trend: [
    { date: '2026-09-13', dailyLoadAu: 250, shortTermLoadAu: 270, longTermLoadAu: 245, loadBalanceAu: 25, status: 'available' },
    { date: '2026-09-14', dailyLoadAu: 300, shortTermLoadAu: 280, longTermLoadAu: 250, loadBalanceAu: 30, status: 'available' },
  ],
}

const adherence: AdherenceAnalyticsProjection = {
  window: { kind: 'week', startDate: '2026-09-08', endDate: '2026-09-14' },
  rule: { ruleId: 'plan-adherence', version: 1 },
  coverage: { eligiblePlannedSessions: 5, confirmedOutcomeSessions: 4, unknownSessions: 1, unplannedRealizedSessions: 0, coveragePercent: 80 },
  frequency: { state: 'available', counts: { confirmedCompleted: 4, confirmedNotCompleted: 0, denominator: 4 }, adherencePercent: 100 },
  dimensions: [], limitations: [],
}

const competition: CompetitionAnalyticsProjection = {
  primaryCompetition: { id: 'race-a', name: 'Trail 21K', date: '2026-10-03', distanceKm: 21, elevationGain: 1200, priority: 'A' },
  intermediateCompetitions: [],
}

const input = {
  period: { startDate: '2026-09-01', endDate: '2026-09-14' },
  training,
  trainingEvolution: evolution,
  trainingSeries: [
    { date: '2026-09-13', sessions: 2, distanceKm: 18, durationMin: 150, elevationGainM: 900 },
    { date: '2026-09-14', sessions: 1, distanceKm: null, durationMin: 90, elevationGainM: 500 },
  ],
  load,
  adherence,
  competition,
}

describe('athlete stats projections', () => {
  it('builds the summary from an explicit athlete-safe allowlist', () => {
    const result = projectAthleteStatsSummary(input)
    assert.deepEqual(result.period, input.period)
    assert.equal(result.training.distance.value, 42)
    assert.equal(result.training.distance.unit, 'km')
    assert.equal(result.training.distance.comparison.direction, 'increasing')
    assert.equal(result.load.state, 'available')
    assert.equal(result.adherence.value, 100)
    assert.equal(result.competition?.distanceKm, 21)
  })

  it('does not expose analytics internals or coach-only disclosure semantics', () => {
    const serialized = JSON.stringify(projectAthleteStatsSummary(input))
    for (const forbidden of ['priority', 'reasonCodes', 'acknowledgement', 'contributors', 'ruleVersion', 'readiness', 'recommendation', 'prediction']) {
      assert.equal(serialized.includes(`\"${forbidden}\"`), false, `must not expose ${forbidden}`)
    }
  })

  it('provides allowlisted detail projections without changing neutral meaning', () => {
    const result = projectAthleteStatsDetails(input)
    assert.equal(result.training.distance.unit, 'km')
    assert.equal(result.training.elevation.unit, 'm')
    assert.equal(result.training.duration.unit, 'min')
    assert.equal(result.load.shortTermLoadAu, 280)
    assert.equal(result.load.longTermLoadAu, 250)
    assert.equal(result.adherence.coveragePercent, 80)
    assert.equal(result.competition.primaryCompetition?.name, 'Trail 21K')
  })

  it('exposes only factual training and load series through athlete details', () => {
    const result = projectAthleteStatsDetails(input)
    assert.deepEqual(result.training.series, input.trainingSeries)
    assert.deepEqual(result.load.trend, load.trend)
    assert.equal(result.training.series[1]?.distanceKm, null)
  })

  it('represents no competition as a valid empty state', () => {
    const result = projectAthleteStatsSummary({ ...input, competition: { primaryCompetition: null, intermediateCompetitions: [] } })
    assert.equal(result.competition, null)
  })

  it('preserves unknown training evidence and non-evaluable comparison without inventing zero', () => {
    const result = projectAthleteStatsSummary({
      ...input,
      training: { ...training, distance: { state: 'unknown', reason: 'metric_not_observed', knownRecords: 0, observedRecords: 4 } },
      trainingEvolution: { ...evolution, distance: unknownComparison },
    })
    assert.equal(result.training.distance.state, 'unknown')
    assert.equal(result.training.distance.value, null)
    assert.equal(result.training.distance.evidence.observedRecords, 4)
    assert.equal(result.training.distance.evidence.knownRecords, 0)
    assert.equal(result.training.distance.comparison.state, 'not_evaluable')
  })

  it('preserves insufficient load and adherence as distinct athlete-visible evidence states', () => {
    const result = projectAthleteStatsDetails({
      ...input,
      load: { state: 'insufficient_data', startDate: '2026-09-01', endDate: '2026-09-14', ruleVersion: 'srpe-duration-v1', coverageRatio: 0.4, reasons: ['insufficient_history'], latest: null, trend: [] },
      adherence: { ...adherence, frequency: { state: 'insufficient_data', counts: { confirmedCompleted: 0, confirmedNotCompleted: 0, denominator: 0 }, adherencePercent: null, reasons: ['insufficient_confirmed_outcomes'] } },
    })
    assert.equal(result.load.state, 'insufficient_data')
    assert.equal(result.load.coverageRatio, 0.4)
    assert.deepEqual(result.load.trend, [])
    assert.equal(result.adherence.state, 'insufficient_data')
    assert.equal(result.adherence.value, null)
    assert.equal(result.adherence.coveragePercent, 80)
    assert.equal(JSON.stringify(result).includes('insufficient_history'), false)
    assert.equal(JSON.stringify(result).includes('insufficient_confirmed_outcomes'), false)
  })

  it('does not leak newly attached coach-facing properties through structural spreading', () => {
    const extended = {
      ...input,
      load: { ...load, recommendation: 'reduce-load', readiness: 'low' },
      adherence: { ...adherence, reasonCodes: ['coach-only'] },
      competition: { ...competition, primaryCompetition: { ...competition.primaryCompetition!, prediction: 'finish-time' } },
    }
    const serialized = JSON.stringify(projectAthleteStatsDetails(extended))
    assert.equal(serialized.includes('recommendation'), false)
    assert.equal(serialized.includes('readiness'), false)
    assert.equal(serialized.includes('reasonCodes'), false)
    assert.equal(serialized.includes('prediction'), false)
  })
})
