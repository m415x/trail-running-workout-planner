import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { deriveAthleteAdherenceTrend } from '@/lib/adherence/adherence-trend'
import { DEFAULT_ADHERENCE_RULE } from '@/lib/adherence/athlete-adherence'
import type { AthleteAdherence } from '@/types'

function adherence(
  week: number,
  adherencePercent: number | null,
  coveragePercent = 100,
): AthleteAdherence {
  const startDay = 1 + ((week - 1) * 7)
  const endDay = startDay + 6
  const frequency = adherencePercent === null
    ? {
        state: 'insufficient_data' as const,
        counts: {
          confirmedCompleted: 0,
          confirmedNotCompleted: 0,
          denominator: 0,
        },
        adherencePercent: null,
        reasons: ['insufficient_confirmed_outcomes' as const],
      }
    : {
        state: 'available' as const,
        counts: {
          confirmedCompleted: 2,
          confirmedNotCompleted: 0,
          denominator: 2,
        },
        adherencePercent,
      }

  return {
    teamId: 'team-1',
    athleteId: 'athlete-1',
    window: {
      kind: 'week',
      startDate: `2026-09-${String(startDay).padStart(2, '0')}`,
      endDate: `2026-09-${String(endDay).padStart(2, '0')}`,
    },
    rule: DEFAULT_ADHERENCE_RULE,
    coverage: {
      eligiblePlannedSessions: 2,
      confirmedOutcomeSessions: adherencePercent === null ? 0 : 2,
      unknownSessions: adherencePercent === null ? 2 : 0,
      unplannedRealizedSessions: 0,
      coveragePercent,
    },
    frequency,
    dimensions: [],
    limitations: [],
  }
}

describe('adherence trend', () => {
  it('reports improving when the available change exceeds the stable band', () => {
    const result = deriveAthleteAdherenceTrend([
      adherence(1, 50),
      adherence(2, 60),
      adherence(3, 80),
      adherence(4, 100),
    ])

    assert.equal(result.state, 'available')
    assert.equal(result.direction, 'improving')
    assert.equal(result.changePercentagePoints, 50)
  })

  it('reports declining when the available change is negative enough', () => {
    const result = deriveAthleteAdherenceTrend([
      adherence(1, 100),
      adherence(2, 80),
      adherence(3, 60),
    ])

    assert.equal(result.state, 'available')
    assert.equal(result.direction, 'declining')
    assert.equal(result.changePercentagePoints, -40)
  })

  it('keeps small changes stable', () => {
    const result = deriveAthleteAdherenceTrend([
      adherence(1, 80),
      adherence(2, 82),
      adherence(3, 84),
    ])

    assert.equal(result.state, 'available')
    assert.equal(result.direction, 'stable')
  })

  it('ignores insufficient weeks and refuses a trend below the minimum', () => {
    const result = deriveAthleteAdherenceTrend([
      adherence(1, 80),
      adherence(2, null, 25),
      adherence(3, 90),
      adherence(4, null, 0),
    ])

    assert.equal(result.state, 'insufficient_data')
    assert.equal(result.direction, null)
    assert.ok(result.reasons.includes('insufficient_comparable_windows'))
    assert.equal(result.points.filter(point => point.adherencePercent === null).length, 2)
  })
})
