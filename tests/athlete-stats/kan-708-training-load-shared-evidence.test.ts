import assert from 'node:assert/strict'
import test from 'node:test'

import { loadAthleteStatsProjectionInput } from '@/lib/athlete-stats/athlete-stats-source-adapter'
import type { AthleteStatsSourceDependencies } from '@/lib/athlete-stats/athlete-stats-source-adapter'
import type { RealizedTrainingRecord } from '@/types/training/readiness.types'
import { buildAthleteTrainingLoadState } from '@/lib/training-load/athlete-training-load'

test('KAN-708 derives load from the same authorized current-period realized records, with no second independent read', async () => {
  const current: RealizedTrainingRecord[] = []
  const previous: RealizedTrainingRecord[] = []
  const calls: string[] = []
  let sharedRecords: readonly RealizedTrainingRecord[] | undefined

  const source = {
    listRealizedTraining: async ({ startDate }: { startDate: string }) => {
      calls.push(startDate)
      return startDate === '2026-09-08' ? current : previous
    },
    getTrainingLoad: async (scope: { athleteId: string; startDate: string; endDate: string }, records: readonly RealizedTrainingRecord[]) => {
      sharedRecords = records
      return buildAthleteTrainingLoadState({ ...scope, records })
    },
    getAdherence: async () => ({
      window: { kind: 'week', startDate: '2026-09-08', endDate: '2026-09-14' },
      rule: { ruleId: 'plan-adherence', version: 1 },
      coverage: { eligiblePlannedSessions: 0, confirmedOutcomeSessions: 0, unknownSessions: 0, unplannedRealizedSessions: 0, coveragePercent: null },
      frequency: { state: 'insufficient_data', counts: { confirmedCompleted: 0, confirmedNotCompleted: 0, denominator: 0 }, adherencePercent: null, reasons: ['no_eligible_planned_sessions'] },
      dimensions: [], limitations: [],
    }),
    getCompetitionContext: async () => ({ primaryCompetition: null, intermediateCompetitions: [] }),
  } as unknown as AthleteStatsSourceDependencies

  const result = await loadAthleteStatsProjectionInput(
    { athleteId: 'athlete-a', teamId: 'team-a' },
    { startDate: '2026-09-08', endDate: '2026-09-14' },
    source,
  )
  assert.deepEqual(calls, ['2026-09-08', '2026-09-01'])
  assert.strictEqual(sharedRecords, current, 'Load analytics must consume the same authorized evidence as Training')
  assert.equal(result.load.state, 'insufficient_data')
})
