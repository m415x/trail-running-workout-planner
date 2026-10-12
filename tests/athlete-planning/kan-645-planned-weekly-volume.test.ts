import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { projectAthletePlannedWeeklyVolume } from '@/lib/athlete-planning/planned-weekly-volume'

describe('KAN-645/T4 — weekly planned distance and D+ evidence', () => {
  it('aggregates only effective prescription and athlete-adjustment values in the effective week', () => {
    const result = projectAthletePlannedWeeklyVolume('2026-10-05', [
      { id: 'a', date: '2026-10-06', distanceKm: 12, elevationGain: 400 },
      { id: 'b', date: '2026-10-07', distanceKm: 8, elevationGain: 250 },
      { id: 'moved-out', date: '2026-10-13', distanceKm: 20, elevationGain: 700 },
    ])
    assert.deepEqual(result, {
      status: 'loaded',
      distance: { status: 'complete', value: 20 },
      elevationGain: { status: 'complete', value: 650 },
    })
  })

  it('never disguises missing distance or D+ evidence as zero or a complete total', () => {
    assert.deepEqual(projectAthletePlannedWeeklyVolume('2026-10-05', [
      { id: 'a', date: '2026-10-06', distanceKm: 10, elevationGain: null },
      { id: 'b', date: '2026-10-07', distanceKm: null, elevationGain: 300 },
    ]), {
      status: 'loaded',
      distance: { status: 'incomplete', value: null },
      elevationGain: { status: 'incomplete', value: null },
    })
  })

  it('preserves explicit known zero independently of unknown measurements', () => {
    assert.deepEqual(projectAthletePlannedWeeklyVolume('2026-10-05', [
      { id: 'a', date: '2026-10-06', distanceKm: 0, elevationGain: 0 },
    ]), {
      status: 'loaded',
      distance: { status: 'complete', value: 0 },
      elevationGain: { status: 'complete', value: 0 },
    })
  })

  it('does not report missing sessions as measured zero', () => {
    assert.deepEqual(projectAthletePlannedWeeklyVolume('2026-10-05', []), {
      status: 'empty',
      distance: { status: 'unknown', value: null },
      elevationGain: { status: 'unknown', value: null },
    })
  })

  it('deduplicates identical effective session identities and rejects inconsistent duplicates', () => {
    const once = { id: 'a', date: '2026-10-06', distanceKm: 10, elevationGain: 250 }
    assert.deepEqual(projectAthletePlannedWeeklyVolume('2026-10-05', [once, once]), {
      status: 'loaded',
      distance: { status: 'complete', value: 10 },
      elevationGain: { status: 'complete', value: 250 },
    })
    assert.deepEqual(projectAthletePlannedWeeklyVolume('2026-10-05', [
      once, { ...once, distanceKm: 11 },
    ]), { status: 'error' })
  })
})
