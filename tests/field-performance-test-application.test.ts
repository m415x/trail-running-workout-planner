import assert from 'node:assert/strict'
import test from 'node:test'

import { correctTrack1000mEvidence, createTrack1000mEvidence } from '@/lib/physiology/field-performance-test-application'
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


test('corrects owned evidence through the atomic replacement boundary', async () => {
  const replacements: Array<{ id: string; replacement: InsertFieldPerformanceTest; updatedAt: string }> = []

  const result = await correctTrack1000mEvidence(
    {
      athleteId: 'athlete_1',
      evidenceId: 'old_1',
      replacement: {
        performedAt: '2026-09-25',
        elapsedTimeSec: 214.25,
        notes: 'cronometraje corregido',
      },
    },
    {
      resolveOwnedAthlete: async id => id === 'athlete_1' ? { id } : null,
      getById: id => id === 'old_1'
        ? {
            id,
            athleteId: 'athlete_1',
            performedAt: '2026-09-24',
            protocol: '1000m_track',
            distanceM: 1000,
            elapsedTimeSec: 215,
            notes: null,
            isDeleted: false,
            createdAt: '2026-09-24T12:00:00.000Z',
            updatedAt: '2026-09-24T12:00:00.000Z',
          }
        : undefined,
      replace: (id, replacement, updatedAt) => {
        replacements.push({ id, replacement, updatedAt })
        return { ...replacement, isDeleted: false }
      },
      newId: () => 'new_1',
      now: () => '2026-09-25T12:00:00.000Z',
    },
  )

  assert.equal(result.success, true)
  assert.equal(replacements.length, 1)
  assert.equal(replacements[0]?.id, 'old_1')
  assert.equal(replacements[0]?.updatedAt, '2026-09-25T12:00:00.000Z')
  assert.equal(replacements[0]?.replacement.id, 'new_1')
  assert.equal(replacements[0]?.replacement.elapsedTimeSec, 214.25)
})

test('cannot correct evidence owned by another athlete', async () => {
  let invalidations = 0
  let inserts = 0

  const result = await correctTrack1000mEvidence(
    {
      athleteId: 'athlete_1',
      evidenceId: 'other_evidence',
      replacement: { performedAt: '2026-09-25', elapsedTimeSec: 214 },
    },
    {
      resolveOwnedAthlete: async id => ({ id }),
      getById: () => ({
        id: 'other_evidence',
        athleteId: 'athlete_2',
        performedAt: '2026-09-24',
        protocol: '1000m_track',
        distanceM: 1000,
        elapsedTimeSec: 215,
        notes: null,
        isDeleted: false,
        createdAt: '2026-09-24T12:00:00.000Z',
        updatedAt: '2026-09-24T12:00:00.000Z',
      }),
      invalidate: () => { invalidations += 1 },
      insert: evidence => {
        inserts += 1
        return { ...evidence, isDeleted: false }
      },
      newId: () => 'must_not_be_used',
      now: () => '2026-09-25T12:00:00.000Z',
    },
  )

  assert.deepEqual(result, { success: false, error: 'evidence_not_found' })
  assert.equal(invalidations, 0)
  assert.equal(inserts, 0)
})


test('invalid replacement leaves the original evidence active and writes nothing', async () => {
  let invalidations = 0
  let inserts = 0

  const result = await correctTrack1000mEvidence(
    {
      athleteId: 'athlete_1',
      evidenceId: 'old_1',
      replacement: { performedAt: '2026-02-30', elapsedTimeSec: 0 },
    },
    {
      resolveOwnedAthlete: async id => ({ id }),
      getById: id => ({
        id,
        athleteId: 'athlete_1',
        performedAt: '2026-09-24',
        protocol: '1000m_track',
        distanceM: 1000,
        elapsedTimeSec: 215,
        notes: null,
        isDeleted: false,
        createdAt: '2026-09-24T12:00:00.000Z',
        updatedAt: '2026-09-24T12:00:00.000Z',
      }),
      invalidate: () => { invalidations += 1 },
      insert: evidence => {
        inserts += 1
        return { ...evidence, isDeleted: false }
      },
      newId: () => 'must_not_be_used',
      now: () => '2026-09-25T12:00:00.000Z',
    },
  )

  assert.equal(result.success, false)
  assert.equal(invalidations, 0)
  assert.equal(inserts, 0)
})
