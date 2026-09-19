import assert from 'node:assert/strict'
import test from 'node:test'

import { createTrack1000mEvidence } from '@/lib/physiology/field-performance-test-application'
import type { InsertFieldPerformanceTest } from '@/lib/physiology/field-performance-test-sqlite'

test('creates canonical 1000m evidence only after athlete ownership is resolved', async () => {
  const inserted: InsertFieldPerformanceTest[] = []

  const result = await createTrack1000mEvidence(
    {
      athleteId: 'athlete_1',
      performedAt: '2026-09-24',
      elapsedTimeSec: 215.5,
      notes: 'control mensual',
    },
    {
      resolveOwnedAthlete: async athleteId => athleteId === 'athlete_1' ? { id: athleteId } : null,
      insert: evidence => {
        inserted.push(evidence)
        return { ...evidence, isDeleted: false }
      },
      newId: () => 'test_1',
      now: () => '2026-09-24T12:00:00.000Z',
    },
  )

  assert.equal(result.success, true)
  assert.equal(inserted.length, 1)
  assert.deepEqual(inserted[0], {
    id: 'test_1',
    athleteId: 'athlete_1',
    performedAt: '2026-09-24',
    protocol: '1000m_track',
    distanceM: 1000,
    elapsedTimeSec: 215.5,
    notes: 'control mensual',
    createdAt: '2026-09-24T12:00:00.000Z',
    updatedAt: '2026-09-24T12:00:00.000Z',
  })
})

test('rejects an athlete outside the authorized team before persistence', async () => {
  let insertCalls = 0

  const result = await createTrack1000mEvidence(
    {
      athleteId: 'other_team_athlete',
      performedAt: '2026-09-24',
      elapsedTimeSec: 215,
    },
    {
      resolveOwnedAthlete: async () => null,
      insert: evidence => {
        insertCalls += 1
        return { ...evidence, isDeleted: false }
      },
      newId: () => 'must_not_be_used',
      now: () => '2026-09-24T12:00:00.000Z',
    },
  )

  assert.deepEqual(result, { success: false, error: 'athlete_not_found' })
  assert.equal(insertCalls, 0)
})
