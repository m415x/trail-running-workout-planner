import type { AthleteStatsProjectionInput } from '@/lib/athlete-stats/athlete-stats-projections'

const previousUnknown = {
  state: 'not_evaluable' as const,
  currentValue: 0,
  previousValue: null,
  absoluteDelta: null,
  relativeDeltaPercent: null,
  direction: 'unknown' as const,
  reason: 'previous_unknown' as const,
}

const currentUnknown = {
  state: 'not_evaluable' as const,
  currentValue: null,
  previousValue: null,
  absoluteDelta: null,
  relativeDeltaPercent: null,
  direction: 'unknown' as const,
  reason: 'current_unknown' as const,
}

/**
 * Cross-layer semantic fixture for KAN-355.
 *
 * It deliberately combines valid edge states that must remain distinct at the
 * athlete projection boundary: known zero, unknown metric evidence,
 * insufficient analytics evidence, no comparable previous period and no
 * competition context.
 */
export const athleteStatsSemanticFixture = {
  period: { startDate: '2026-09-01', endDate: '2026-09-14' },
  training: {
    frequency: { state: 'available', value: 0 },
    distance: { state: 'unknown', reason: 'metric_not_observed', knownRecords: 0, observedRecords: 1 },
    duration: { state: 'unknown', reason: 'metric_not_observed', knownRecords: 0, observedRecords: 1 },
    elevation: { state: 'unknown', reason: 'metric_not_observed', knownRecords: 0, observedRecords: 1 },
  },
  trainingEvolution: {
    frequency: previousUnknown,
    distance: currentUnknown,
    duration: currentUnknown,
    elevation: currentUnknown,
  },
  trainingSeries: [],
  load: {
    state: 'insufficient_data',
    startDate: '2026-09-01',
    endDate: '2026-09-14',
    ruleVersion: 'srpe-duration-v1',
    coverageRatio: 0.25,
    reasons: ['insufficient_history'],
    latest: null,
    trend: [],
  },
  adherence: {
    window: { kind: 'week', startDate: '2026-09-08', endDate: '2026-09-14' },
    rule: { ruleId: 'plan-adherence', version: 1 },
    coverage: {
      eligiblePlannedSessions: 2,
      confirmedOutcomeSessions: 0,
      unknownSessions: 2,
      unplannedRealizedSessions: 0,
      coveragePercent: 0,
    },
    frequency: {
      state: 'insufficient_data',
      counts: { confirmedCompleted: 0, confirmedNotCompleted: 0, denominator: 0 },
      adherencePercent: null,
      reasons: ['insufficient_confirmed_outcomes'],
    },
    dimensions: [],
    limitations: [],
  },
  competition: { primaryCompetition: null, intermediateCompetitions: [] },
} satisfies AthleteStatsProjectionInput
