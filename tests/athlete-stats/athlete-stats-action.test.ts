import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAthleteStatsAction } from '@/lib/athlete-stats/athlete-stats-action'
import type { AthleteStatsProjectionInput } from '@/lib/athlete-stats/athlete-stats-projections'

const projectionInput = {
  period: { startDate: '2026-09-08', endDate: '2026-09-14' },
  training: {
    frequency: { state: 'unknown', reason: 'no_realized_evidence' },
    distance: { state: 'unknown', reason: 'no_realized_evidence', knownRecords: 0, observedRecords: 0 },
    duration: { state: 'unknown', reason: 'no_realized_evidence', knownRecords: 0, observedRecords: 0 },
    elevation: { state: 'unknown', reason: 'no_realized_evidence', knownRecords: 0, observedRecords: 0 },
  },
  trainingEvolution: {
    frequency: { state: 'not_evaluable', currentValue: null, previousValue: null, absoluteDelta: null, relativeDeltaPercent: null, direction: 'unknown', reason: 'current_unknown' },
    distance: { state: 'not_evaluable', currentValue: null, previousValue: null, absoluteDelta: null, relativeDeltaPercent: null, direction: 'unknown', reason: 'current_unknown' },
    duration: { state: 'not_evaluable', currentValue: null, previousValue: null, absoluteDelta: null, relativeDeltaPercent: null, direction: 'unknown', reason: 'current_unknown' },
    elevation: { state: 'not_evaluable', currentValue: null, previousValue: null, absoluteDelta: null, relativeDeltaPercent: null, direction: 'unknown', reason: 'current_unknown' },
  },
  load: { state: 'insufficient_data', startDate: '2026-09-08', endDate: '2026-09-14', ruleVersion: 'srpe-duration-v1', coverageRatio: 0, reasons: ['insufficient_history'], latest: null },
  adherence: {
    window: { kind: 'week', startDate: '2026-09-08', endDate: '2026-09-14' },
    rule: { ruleId: 'plan-adherence', version: 1 },
    coverage: { eligiblePlannedSessions: 0, confirmedOutcomeSessions: 0, unknownSessions: 0, unplannedRealizedSessions: 0, coveragePercent: null },
    frequency: { state: 'insufficient_data', counts: { confirmedCompleted: 0, confirmedNotCompleted: 0, denominator: 0 }, adherencePercent: null, reasons: ['no_eligible_planned_sessions'] },
    dimensions: [], limitations: [],
  },
  competition: { primaryCompetition: null, intermediateCompetitions: [] },
} satisfies AthleteStatsProjectionInput

describe('athlete stats action wiring', () => {
  it('derives the stats subject from the current-athlete boundary', async () => {
    let loadedSubject: { athleteId: string; teamId: string } | null = null
    const action = createAthleteStatsAction({
      getCurrentAthlete: async () => ({ success: true, data: { athleteProfile: { id: 'athlete-1', teamId: 'team-1', isDeleted: false } } }),
      loadProjectionInput: async subject => { loadedSubject = subject; return projectionInput },
    })

    const result = await action({ startDate: '2026-09-08', endDate: '2026-09-14', view: 'summary' })

    assert.equal(result.status, 'success')
    assert.deepEqual(loadedSubject, { athleteId: 'athlete-1', teamId: 'team-1' })
  })

  it('does not manufacture a subject when current-athlete resolution is unavailable', async () => {
    let loaded = false
    const action = createAthleteStatsAction({
      getCurrentAthlete: async () => ({ success: false, error: 'not found' }),
      loadProjectionInput: async () => { loaded = true; return projectionInput },
    })

    const result = await action({ startDate: '2026-09-08', endDate: '2026-09-14', view: 'details' })

    assert.deepEqual(result, { status: 'error', code: 'current_athlete_unavailable' })
    assert.equal(loaded, false)
  })
})
