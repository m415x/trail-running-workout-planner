import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { deriveDailyTrainingLoad } from '@/lib/training-load/daily-training-load'
import type { RealizedTrainingRecord } from '@/types'

function metric(value: number | null) {
  return value === null
    ? { state: 'unknown' as const, reason: 'not_recorded' as const }
    : { state: 'known' as const, value }
}

function record(input: {
  id: string
  status?: RealizedTrainingRecord['status']
  durationMin?: number | null
  rpe?: number | null
  distanceKm?: number | null
  elevationGainM?: number | null
}): RealizedTrainingRecord {
  const status = input.status ?? 'completed'
  const durationMin = input.durationMin === undefined ? 60 : input.durationMin
  const rpe = input.rpe === undefined ? 5 : input.rpe

  return {
    id: input.id,
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sessionId: `session-${input.id}`,
    workoutId: `workout-${input.id}`,
    date: '2026-09-14',
    performedAt: '2026-09-14T10:00:00-03:00',
    status,
    metrics: {
      distanceKm: metric(input.distanceKm ?? 10),
      durationMin: metric(durationMin),
      elevationGainM: metric(input.elevationGainM ?? 500),
      avgHrBpm: metric(150),
      rpe: metric(rpe),
    },
    provenance: {
      source: 'manual',
      sourceActivityId: null,
      loggedAt: '2026-09-14T12:00:00.000Z',
      sessionLink: 'explicit',
    },
    quality: status === 'completed' || status === 'partial' ? 'usable' : 'non_exposure',
    limitations: [],
  }
}

describe('daily training load', () => {
  it('calculates session-RPE load from reliable duration and RPE only', () => {
    const result = deriveDailyTrainingLoad('2026-09-14', [record({
      id: 'a',
      durationMin: 80,
      rpe: 6,
      elevationGainM: 1200,
    })])

    assert.equal(result.state, 'known_load')
    assert.equal(result.loadAu, 480)
    assert.equal(result.durationMin, 80)
    assert.equal(result.rpe, 6)
    assert.equal(result.external.elevationGainM, 1200)
  })

  it('sums multiple performed sessions on the same day', () => {
    const result = deriveDailyTrainingLoad('2026-09-14', [
      record({ id: 'a', durationMin: 60, rpe: 5 }),
      record({ id: 'b', durationMin: 30, rpe: 4 }),
    ])

    assert.equal(result.state, 'known_load')
    assert.equal(result.loadAu, 420)
    assert.equal(result.durationMin, 90)
    assert.equal(result.rpe, null)
    assert.deepEqual(result.sourceRecordIds, ['a', 'b'])
  })

  it('keeps a performed day unknown when any performed session lacks a required input', () => {
    const result = deriveDailyTrainingLoad('2026-09-14', [
      record({ id: 'a', durationMin: 60, rpe: 5 }),
      record({ id: 'b', durationMin: 40, rpe: null }),
    ])

    assert.equal(result.state, 'unknown_load')
    assert.equal(result.loadAu, null)
    assert.deepEqual(result.missingRequiredMetrics, ['rpe'])
  })

  it('treats explicit non-exposure evidence as confirmed rest when no training occurred', () => {
    const result = deriveDailyTrainingLoad('2026-09-14', [
      record({ id: 'rest', status: 'rest', durationMin: null, rpe: null }),
    ])

    assert.equal(result.state, 'confirmed_rest')
    assert.equal(result.loadAu, 0)
  })

  it('does not treat absence of realized evidence as zero load', () => {
    const result = deriveDailyTrainingLoad('2026-09-14', [])

    assert.equal(result.state, 'no_evidence')
    assert.equal(result.loadAu, null)
    assert.deepEqual(result.sourceRecordIds, [])
  })

  it('does not let elevation change internal load', () => {
    const flat = deriveDailyTrainingLoad('2026-09-14', [record({
      id: 'flat',
      durationMin: 60,
      rpe: 6,
      elevationGainM: 0,
    })])
    const mountain = deriveDailyTrainingLoad('2026-09-14', [record({
      id: 'mountain',
      durationMin: 60,
      rpe: 6,
      elevationGainM: 1800,
    })])

    assert.equal(flat.loadAu, 360)
    assert.equal(mountain.loadAu, 360)
  })
})
