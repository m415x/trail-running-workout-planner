import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildTrainingLoadEvidenceWindow } from '@/lib/training-load/training-load-evidence'
import type { RealizedTrainingRecord } from '@/types'

function known(value: number) {
  return { state: 'known' as const, value }
}

function unknown() {
  return { state: 'unknown' as const, reason: 'not_recorded' as const }
}

function realized(input: {
  id: string
  date: string
  status?: RealizedTrainingRecord['status']
  durationMin?: number | null
  rpe?: number | null
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
    date: input.date,
    performedAt: `${input.date}T10:00:00-03:00`,
    status,
    metrics: {
      distanceKm: known(10),
      durationMin: durationMin === null ? unknown() : known(durationMin),
      elevationGainM: known(500),
      avgHrBpm: known(150),
      rpe: rpe === null ? unknown() : known(rpe),
    },
    provenance: {
      source: 'manual',
      sourceActivityId: null,
      loggedAt: `${input.date}T15:00:00.000Z`,
      sessionLink: 'explicit',
    },
    quality: status === 'completed' || status === 'partial' ? 'usable' : 'non_exposure',
    limitations: [],
  }
}

function dates(startDate: string, count: number): string[] {
  const values: string[] = []
  const date = new Date(`${startDate}T00:00:00Z`)
  for (let index = 0; index < count; index += 1) {
    values.push(date.toISOString().slice(0, 10))
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return values
}

describe('training load evidence window', () => {
  it('counts known load, confirmed rest and gaps separately', () => {
    const result = buildTrainingLoadEvidenceWindow({
      startDate: '2026-09-12',
      endDate: '2026-09-14',
      records: [
        realized({ id: 'load', date: '2026-09-12' }),
        realized({ id: 'rest', date: '2026-09-14', status: 'rest', durationMin: null, rpe: null }),
      ],
    })

    assert.deepEqual(result.days.map(day => day.state), [
      'known_load',
      'no_evidence',
      'confirmed_rest',
    ])
    assert.deepEqual(result.coverage, {
      observedDays: 3,
      knownLoadDays: 1,
      confirmedRestDays: 1,
      unknownLoadDays: 0,
      noEvidenceDays: 1,
      usableDays: 2,
      currentUsableStreakDays: 1,
      coverageRatio: 2 / 3,
    })
  })

  it('is insufficient when the window contains no reliable load or rest evidence', () => {
    const result = buildTrainingLoadEvidenceWindow({
      startDate: '2026-09-12',
      endDate: '2026-09-14',
      records: [],
    })

    assert.equal(result.status, 'insufficient_data')
    assert.ok(result.insufficientReasons.includes('no_reliable_evidence'))
  })

  it('reports warming up while the current reliable streak is shorter than 42 days', () => {
    const result = buildTrainingLoadEvidenceWindow({
      startDate: '2026-08-04',
      endDate: '2026-09-14',
      records: [realized({ id: 'load', date: '2026-09-14' })],
    })

    assert.equal(result.status, 'warming_up')
    assert.equal(result.coverage.currentUsableStreakDays, 1)
    assert.ok(result.insufficientReasons.includes('insufficient_history'))
  })

  it('becomes available after 42 consecutive reliable days', () => {
    const reliableDates = dates('2026-08-04', 42)
    const records = reliableDates.map((date, index) => realized({
      id: `day-${index}`,
      date,
      ...(index === 41 ? {} : { status: 'rest' as const, durationMin: null, rpe: null }),
    }))

    const result = buildTrainingLoadEvidenceWindow({
      startDate: reliableDates[0]!,
      endDate: reliableDates[41]!,
      records,
    })

    assert.equal(result.days.length, 42)
    assert.equal(result.coverage.currentUsableStreakDays, 42)
    assert.equal(result.status, 'available')
    assert.deepEqual(result.insufficientReasons, [])
  })
})
