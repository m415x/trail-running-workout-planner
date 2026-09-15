import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { readCurrentAthleteStats } from '@/lib/athlete-stats/athlete-stats-read-service'
import type { AthleteStatsProjectionInput } from '@/lib/athlete-stats/athlete-stats-projections'

const input = {
  period: { startDate: '2026-09-01', endDate: '2026-09-14' },
  training: {
    frequency: { state: 'available', value: 1 },
    distance: { state: 'available', value: 10, knownRecords: 1, observedRecords: 1 },
    duration: { state: 'available', value: 60, knownRecords: 1, observedRecords: 1 },
    elevation: { state: 'available', value: 500, knownRecords: 1, observedRecords: 1 },
  },
  trainingEvolution: {
    frequency: { state: 'not_evaluable', currentValue: 1, previousValue: null, absoluteDelta: null, relativeDeltaPercent: null, direction: 'unknown', reason: 'previous_unknown' },
    distance: { state: 'not_evaluable', currentValue: 10, previousValue: null, absoluteDelta: null, relativeDeltaPercent: null, direction: 'unknown', reason: 'previous_unknown' },
    duration: { state: 'not_evaluable', currentValue: 60, previousValue: null, absoluteDelta: null, relativeDeltaPercent: null, direction: 'unknown', reason: 'previous_unknown' },
    elevation: { state: 'not_evaluable', currentValue: 500, previousValue: null, absoluteDelta: null, relativeDeltaPercent: null, direction: 'unknown', reason: 'previous_unknown' },
  },
  load: {
    state: 'insufficient_data', startDate: '2026-09-01', endDate: '2026-09-14', ruleVersion: 'srpe-duration-v1', coverageRatio: 0.4, reasons: ['insufficient_history'], latest: null,
  },
  adherence: {
    window: { kind: 'week', startDate: '2026-09-08', endDate: '2026-09-14' },
    rule: { ruleId: 'plan-adherence', version: 1 },
    coverage: { eligiblePlannedSessions: 1, confirmedOutcomeSessions: 0, unknownSessions: 1, unplannedRealizedSessions: 0, coveragePercent: 0 },
    frequency: { state: 'insufficient_data', counts: { confirmedCompleted: 0, confirmedNotCompleted: 0, denominator: 0 }, adherencePercent: null, reasons: ['insufficient_confirmed_outcomes'] },
    dimensions: [], limitations: [],
  },
  competition: { primaryCompetition: null, intermediateCompetitions: [] },
} satisfies AthleteStatsProjectionInput

describe('athlete stats read service', () => {
  it('resolves subject server-side and never accepts athleteId as input', async () => {
    let requestedSubject: { athleteId: string; teamId: string } | null = null
    const result = await readCurrentAthleteStats(
      { startDate: '2026-09-01', endDate: '2026-09-14', view: 'summary' },
      {
        resolveCurrentAthlete: async () => ({ athleteId: 'athlete-1', teamId: 'team-1' }),
        loadProjectionInput: async subject => {
          requestedSubject = subject
          return input
        },
      },
    )

    assert.deepEqual(requestedSubject, { athleteId: 'athlete-1', teamId: 'team-1' })
    assert.equal(result.status, 'success')
  })

  it('keeps technical subject-resolution failure distinct from domain unknown states', async () => {
    const result = await readCurrentAthleteStats(
      { startDate: '2026-09-01', endDate: '2026-09-14', view: 'summary' },
      {
        resolveCurrentAthlete: async () => null,
        loadProjectionInput: async () => { throw new Error('must not load') },
      },
    )

    assert.deepEqual(result, { status: 'error', code: 'current_athlete_unavailable' })
  })

  it('returns athlete-safe insufficient and empty states as successful data', async () => {
    const result = await readCurrentAthleteStats(
      { startDate: '2026-09-01', endDate: '2026-09-14', view: 'summary' },
      {
        resolveCurrentAthlete: async () => ({ athleteId: 'athlete-1', teamId: 'team-1' }),
        loadProjectionInput: async () => input,
      },
    )

    assert.equal(result.status, 'success')
    if (result.status !== 'success') assert.fail('expected success')
    assert.equal(result.data.load.state, 'insufficient_data')
    assert.equal(result.data.adherence.state, 'insufficient_data')
    assert.equal(result.data.competition, null)
  })

  it('rejects invalid periods before reading any athlete data', async () => {
    let resolved = false
    const result = await readCurrentAthleteStats(
      { startDate: '2026-09-14', endDate: '2026-09-01', view: 'details' },
      {
        resolveCurrentAthlete: async () => { resolved = true; return { athleteId: 'athlete-1', teamId: 'team-1' } },
        loadProjectionInput: async () => input,
      },
    )

    assert.equal(resolved, false)
    assert.deepEqual(result, { status: 'error', code: 'invalid_period' })
  })
})
