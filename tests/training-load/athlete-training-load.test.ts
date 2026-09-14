import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildAthleteTrainingLoadState } from '@/lib/training-load/athlete-training-load'
import type { RealizedTrainingRecord, TrainingLoadRuleConfig } from '@/types'

function record(date: string): RealizedTrainingRecord {
  const known = (value: number) => ({ state: 'known' as const, value })
  return {
    id: `record-${date}`,
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sessionId: `session-${date}`,
    workoutId: `workout-${date}`,
    date,
    performedAt: `${date}T10:00:00-03:00`,
    status: 'completed',
    metrics: {
      distanceKm: known(10),
      durationMin: known(60),
      elevationGainM: known(500),
      avgHrBpm: known(150),
      rpe: known(5),
    },
    provenance: {
      source: 'manual',
      sourceActivityId: null,
      loggedAt: `${date}T15:00:00.000Z`,
      sessionLink: 'explicit',
    },
    quality: 'usable',
    limitations: [],
  }
}

describe('athlete training load state', () => {
  it('composes evidence and trend under the requested athlete identity', () => {
    const result = buildAthleteTrainingLoadState({
      athleteId: 'athlete-1',
      startDate: '2026-09-13',
      endDate: '2026-09-14',
      records: [record('2026-09-14')],
    })

    assert.equal(result.athleteId, 'athlete-1')
    assert.equal(result.ruleVersion, 'srpe-duration-v1')
    assert.equal(result.days.length, 2)
    assert.equal(result.trend.length, 2)
    assert.equal(result.latest?.date, '2026-09-14')
    assert.equal(result.latest?.dailyLoadAu, 300)
    assert.equal(result.status, 'warming_up')
  })

  it('is deterministic for the same evidence and rule version', () => {
    const input = {
      athleteId: 'athlete-1',
      startDate: '2026-09-14',
      endDate: '2026-09-14',
      records: [record('2026-09-14')],
    }

    assert.deepEqual(
      buildAthleteTrainingLoadState(input),
      buildAthleteTrainingLoadState(input),
    )
  })

  it('preserves rule version and applies versioned parameters', () => {
    const rule: TrainingLoadRuleConfig = {
      version: 'srpe-duration-test-v2',
      method: 'session_rpe_duration',
      unit: 'AU',
      shortTermTimeConstantDays: 3,
      longTermTimeConstantDays: 14,
      minimumWarmupDays: 1,
      resetOnUnknownEvidence: true,
      requiredMetricFields: ['durationMin', 'rpe'],
    }

    const result = buildAthleteTrainingLoadState({
      athleteId: 'athlete-1',
      startDate: '2026-09-14',
      endDate: '2026-09-14',
      records: [record('2026-09-14')],
      rule,
    })

    assert.equal(result.ruleVersion, 'srpe-duration-test-v2')
    assert.equal(result.status, 'available')
  })
})
