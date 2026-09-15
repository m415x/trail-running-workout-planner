import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { projectAdherenceAnalytics } from '@/lib/analytics/adherence/adherence-analytics'
import type { AthleteAdherence } from '@/types/training/adherence.types'

const base: AthleteAdherence = {
  teamId: 'team-1',
  athleteId: 'athlete-1',
  window: { kind: 'week', startDate: '2026-09-01', endDate: '2026-09-07' },
  rule: {
    ruleId: 'plan-adherence',
    version: 1,
    minimumConfirmedOutcomes: 1,
    minimumCoveragePercent: 50,
    minimumComparableSessionsPerDimension: 1,
    minimumComparableWindowsForTrend: 2,
    trendStableBandPercentagePoints: 5,
  },
  coverage: {
    eligiblePlannedSessions: 4,
    confirmedOutcomeSessions: 3,
    unknownSessions: 1,
    unplannedRealizedSessions: 1,
    coveragePercent: 75,
  },
  frequency: {
    state: 'available',
    counts: { confirmedCompleted: 2, confirmedNotCompleted: 1, denominator: 3 },
    adherencePercent: 66.6666666667,
  },
  dimensions: [],
  limitations: [],
}

describe('adherence analytics', () => {
  it('preserves authoritative adherence and coverage separately', () => {
    const result = projectAdherenceAnalytics(base)

    assert.equal(result.frequency.state, 'available')
    assert.equal(result.frequency.adherencePercent, base.frequency.adherencePercent)
    assert.equal(result.coverage.coveragePercent, 75)
    assert.equal(result.coverage.unplannedRealizedSessions, 1)
  })

  it('preserves insufficient adherence instead of converting unknown sessions to failure', () => {
    const source: AthleteAdherence = {
      ...base,
      frequency: {
        state: 'insufficient_data',
        counts: { confirmedCompleted: 0, confirmedNotCompleted: 0, denominator: 0 },
        adherencePercent: null,
        reasons: ['insufficient_confirmed_outcomes'],
      },
    }

    const result = projectAdherenceAnalytics(source)
    assert.equal(result.frequency.state, 'insufficient_data')
    assert.equal(result.frequency.adherencePercent, null)
    assert.equal(result.coverage.unknownSessions, 1)
  })
})
