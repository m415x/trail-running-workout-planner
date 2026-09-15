import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEFAULT_ADHERENCE_RULE } from '@/lib/adherence/athlete-adherence'
import { loadAthleteStatsProjectionInput } from '@/lib/athlete-stats/athlete-stats-source-adapter'
import type { AthleteStatsSourceDependencies } from '@/lib/athlete-stats/athlete-stats-source-adapter'
import { TRAINING_LOAD_SIGNAL_RULE_VERSION } from '@/types/training/training-load.types'
import type { AthleteAdherence } from '@/types/training/adherence.types'

const unknownAdherence = {
  teamId: 'team-1',
  athleteId: 'athlete-1',
  window: { kind: 'week', startDate: '2026-09-08', endDate: '2026-09-14' },
  rule: DEFAULT_ADHERENCE_RULE,
  coverage: { eligiblePlannedSessions: 0, confirmedOutcomeSessions: 0, unknownSessions: 0, unplannedRealizedSessions: 0, coveragePercent: null },
  frequency: { state: 'insufficient_data', counts: { confirmedCompleted: 0, confirmedNotCompleted: 0, denominator: 0 }, adherencePercent: null, reasons: ['no_eligible_planned_sessions', 'insufficient_confirmed_outcomes'] },
  dimensions: [], limitations: [],
} satisfies AthleteAdherence

function dependencies(overrides: Partial<AthleteStatsSourceDependencies> = {}): AthleteStatsSourceDependencies {
  return {
    listRealizedTraining: async () => [],
    getTrainingLoad: async ({ athleteId, startDate, endDate }) => ({
      athleteId,
      startDate,
      endDate,
      ruleVersion: 'srpe-duration-v1',
      status: 'insufficient_data',
      insufficientReasons: ['insufficient_history'],
      coverage: {
        observedDays: 0,
        knownLoadDays: 0,
        confirmedRestDays: 0,
        unknownLoadDays: 0,
        noEvidenceDays: 7,
        usableDays: 0,
        currentUsableStreakDays: 0,
        coverageRatio: 0,
      },
      days: [],
      trend: [],
      latest: null,
      semanticSignal: {
        state: 'insufficient_data',
        startDate,
        endDate,
        sourceRuleVersion: 'srpe-duration-v1',
        signalRuleVersion: TRAINING_LOAD_SIGNAL_RULE_VERSION,
        insufficientReasons: ['insufficient_history'],
      },
    }),
    getAdherence: async () => unknownAdherence,
    getCompetitionContext: async () => ({ primaryCompetition: null, intermediateCompetitions: [] }),
    ...overrides,
  }
}

describe('athlete stats source adapter', () => {
  it('loads current and immediately previous realized windows for factual evolution', async () => {
    const calls: Array<{ startDate: string; endDate: string }> = []
    const result = await loadAthleteStatsProjectionInput(
      { athleteId: 'athlete-1', teamId: 'team-1' },
      { startDate: '2026-09-08', endDate: '2026-09-14' },
      dependencies({
        listRealizedTraining: async ({ startDate, endDate }) => { calls.push({ startDate, endDate }); return [] },
      }),
    )

    assert.deepEqual(calls, [
      { startDate: '2026-09-08', endDate: '2026-09-14' },
      { startDate: '2026-09-01', endDate: '2026-09-07' },
    ])
    assert.deepEqual(result.period, { startDate: '2026-09-08', endDate: '2026-09-14' })
    assert.equal(result.training.frequency.state, 'unknown')
    assert.equal(result.trainingEvolution.frequency.state, 'not_evaluable')
  })

  it('passes the server-resolved subject to every subject-scoped source', async () => {
    const subjects: Array<{ athleteId: string; teamId: string }> = []
    await loadAthleteStatsProjectionInput(
      { athleteId: 'athlete-1', teamId: 'team-1' },
      { startDate: '2026-09-08', endDate: '2026-09-14' },
      dependencies({
        listRealizedTraining: async ({ athleteId, teamId }) => { subjects.push({ athleteId, teamId }); return [] },
        getTrainingLoad: async ({ athleteId, teamId, startDate, endDate }) => {
          subjects.push({ athleteId, teamId })
          return dependencies().getTrainingLoad({ athleteId, teamId, startDate, endDate })
        },
        getAdherence: async ({ athleteId, teamId }) => {
          subjects.push({ athleteId, teamId })
          return { ...unknownAdherence, athleteId, teamId }
        },
        getCompetitionContext: async ({ athleteId, teamId }) => { subjects.push({ athleteId, teamId }); return { primaryCompetition: null, intermediateCompetitions: [] } },
      }),
    )

    assert.equal(subjects.length, 5)
    assert.ok(subjects.every(subject => subject.athleteId === 'athlete-1' && subject.teamId === 'team-1'))
  })
})
