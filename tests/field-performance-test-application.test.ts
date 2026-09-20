import assert from 'node:assert/strict'
import test from 'node:test'

import { correctTrack1000mEvidence, createAthleteTrack1000mEvidence, createTrack1000mEvidence, readAthleteTrack1000mEvolution, resolveAthleteRunningReference } from '@/lib/physiology/field-performance-test-application'
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
    source: 'coach_manual',
    distanceM: 1000,
    elapsedTimeSec: 215.5,
    notes: 'control mensual',
    testEventId: null,
    executionContext: 'official',
    recordedBy: 'coach',
    recordedByUserId: null,
    reviewStatus: 'accepted',
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
            source: 'coach_manual',
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
  let replacements = 0

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
        source: 'coach_manual',
        distanceM: 1000,
        elapsedTimeSec: 215,
        notes: null,
        isDeleted: false,
        createdAt: '2026-09-24T12:00:00.000Z',
        updatedAt: '2026-09-24T12:00:00.000Z',
      }),
      replace: (_id, replacement) => {
        replacements += 1
        return { ...replacement, isDeleted: false }
      },
      newId: () => 'must_not_be_used',
      now: () => '2026-09-25T12:00:00.000Z',
    },
  )

  assert.deepEqual(result, { success: false, error: 'evidence_not_found' })
  assert.equal(replacements, 0)
})


test('invalid replacement leaves the original evidence active and writes nothing', async () => {
  let replacements = 0

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
        source: 'coach_manual',
        distanceM: 1000,
        elapsedTimeSec: 215,
        notes: null,
        isDeleted: false,
        createdAt: '2026-09-24T12:00:00.000Z',
        updatedAt: '2026-09-24T12:00:00.000Z',
      }),
      replace: (_id, replacement) => {
        replacements += 1
        return { ...replacement, isDeleted: false }
      },
      newId: () => 'must_not_be_used',
      now: () => '2026-09-25T12:00:00.000Z',
    },
  )

  assert.equal(result.success, false)
  assert.equal(replacements, 0)
})


test('resolves an authorized athlete running reference for the effective date', async () => {
  let queried: { athleteId: string; effectiveDate: string } | undefined

  const result = await resolveAthleteRunningReference(
    { athleteId: 'athlete_1', effectiveDate: '2026-09-20' },
    {
      resolveOwnedAthlete: async id => id === 'athlete_1' ? { id } : null,
      listActiveByAthleteThroughDate: (athleteId, effectiveDate) => {
        queried = { athleteId, effectiveDate }
        return [{
          id: 'eval_1', athleteId, performedAt: '2026-09-17',
          protocol: '1000m_track', source: 'coach_manual', distanceM: 1000,
          elapsedTimeSec: 300, notes: null, isDeleted: false,
          createdAt: '2026-09-17T12:00:00.000Z', updatedAt: '2026-09-17T12:00:00.000Z',
        }]
      },
    },
  )

  assert.deepEqual(queried, { athleteId: 'athlete_1', effectiveDate: '2026-09-20' })
  assert.equal(result.success, true)
  assert.equal(result.success && result.data.status === 'available' ? result.data.source.evaluationId : null, 'eval_1')
})

test('returns explicit unknown for an owned athlete without eligible evidence', async () => {
  const result = await resolveAthleteRunningReference(
    { athleteId: 'athlete_1', effectiveDate: '2026-09-01' },
    {
      resolveOwnedAthlete: async id => ({ id }),
      listActiveByAthleteThroughDate: () => [],
    },
  )

  assert.deepEqual(result, { success: true, data: { status: 'unknown' } })
})

test('does not query evidence when athlete ownership is not resolved', async () => {
  let queryCalls = 0

  const result = await resolveAthleteRunningReference(
    { athleteId: 'other_team_athlete', effectiveDate: '2026-09-20' },
    {
      resolveOwnedAthlete: async () => null,
      listActiveByAthleteThroughDate: () => {
        queryCalls += 1
        return []
      },
    },
  )

  assert.deepEqual(result, { success: false, error: 'athlete_not_found' })
  assert.equal(queryCalls, 0)
})


test('reads factual 1000m evolution only after athlete ownership is resolved', async () => {
  let queriedAthleteId: string | undefined

  const result = await readAthleteTrack1000mEvolution(
    { athleteId: 'athlete_1' },
    {
      resolveOwnedAthlete: async id => id === 'athlete_1' ? { id } : null,
      listActiveByAthlete: athleteId => {
        queriedAthleteId = athleteId
        return [{
          id: 'eval_1', athleteId, performedAt: '2026-09-17',
          protocol: '1000m_track', source: 'coach_manual', distanceM: 1000,
          elapsedTimeSec: 300, notes: null, isDeleted: false,
          createdAt: '2026-09-17T12:00:00.000Z', updatedAt: '2026-09-17T12:00:00.000Z',
        }]
      },
    },
  )

  assert.equal(queriedAthleteId, 'athlete_1')
  assert.equal(result.success, true)
  assert.equal(result.success ? result.data.series[0]?.evaluationId : null, 'eval_1')
  assert.equal(result.success ? result.data.comparison.state : null, 'not_evaluable')
})

test('does not read 1000m evolution when athlete ownership is not resolved', async () => {
  let queryCalls = 0

  const result = await readAthleteTrack1000mEvolution(
    { athleteId: 'other_team_athlete' },
    {
      resolveOwnedAthlete: async () => null,
      listActiveByAthlete: () => {
        queryCalls += 1
        return []
      },
    },
  )

  assert.deepEqual(result, { success: false, error: 'athlete_not_found' })
  assert.equal(queryCalls, 0)
})


test('persists recorder user identity through the create application boundary', async () => {
  const inserted: InsertFieldPerformanceTest[] = []

  const result = await createTrack1000mEvidence(
    {
      athleteId: 'athlete_1',
      performedAt: '2026-09-24',
      elapsedTimeSec: 215.5,
      testEventId: 'event_2026_09',
      executionContext: 'official',
      recordedBy: 'coach',
      recordedByUserId: 'user_coach_1',
    },
    {
      resolveOwnedAthlete: async id => ({ id }),
      insert: evidence => {
        inserted.push(evidence)
        return { ...evidence, isDeleted: false }
      },
      newId: () => 'test_actor_1',
      now: () => '2026-09-24T12:00:00.000Z',
    },
  )

  assert.equal(result.success, true)
  assert.equal(inserted[0]?.recordedBy, 'coach')
  assert.equal(inserted[0]?.recordedByUserId, 'user_coach_1')
})


test('athlete records self-directed evidence as own pending-review submission', async () => {
  const inserted: InsertFieldPerformanceTest[] = []

  const result = await createAthleteTrack1000mEvidence(
    {
      athleteId: 'athlete_1',
      userId: 'user_athlete_1',
      performedAt: '2026-09-20',
      elapsedTimeSec: 302,
      notes: 'control propio',
      executionContext: 'self_directed',
    },
    {
      resolveSelfAthlete: async (athleteId, userId) =>
        athleteId === 'athlete_1' && userId === 'user_athlete_1' ? { id: athleteId } : null,
      insert: evidence => {
        inserted.push(evidence)
        return { ...evidence, isDeleted: false }
      },
      newId: () => 'athlete_test_1',
      now: () => '2026-09-20T15:00:00.000Z',
    },
  )

  assert.equal(result.success, true)
  assert.equal(inserted.length, 1)
  assert.equal(inserted[0]?.executionContext, 'self_directed')
  assert.equal(inserted[0]?.recordedBy, 'athlete')
  assert.equal(inserted[0]?.recordedByUserId, 'user_athlete_1')
  assert.equal(inserted[0]?.reviewStatus, 'pending_review')
  assert.equal(inserted[0]?.testEventId, null)
})

test('athlete registration resolves self subject before persistence', async () => {
  let insertCalls = 0

  const result = await createAthleteTrack1000mEvidence(
    {
      athleteId: 'athlete_2',
      userId: 'user_athlete_1',
      performedAt: '2026-09-20',
      elapsedTimeSec: 302,
      executionContext: 'self_directed',
    },
    {
      resolveSelfAthlete: async () => null,
      insert: evidence => {
        insertCalls += 1
        return { ...evidence, isDeleted: false }
      },
      newId: () => 'must_not_be_used',
      now: () => '2026-09-20T15:00:00.000Z',
    },
  )

  assert.deepEqual(result, { success: false, error: 'athlete_not_found' })
  assert.equal(insertCalls, 0)
})


test('athlete records official evidence only against an eligible owned TestEvent', async () => {
  const inserted: InsertFieldPerformanceTest[] = []

  const result = await createAthleteTrack1000mEvidence(
    {
      athleteId: 'athlete_1',
      userId: 'user_athlete_1',
      performedAt: '2026-09-24',
      elapsedTimeSec: 299,
      executionContext: 'official',
      testEventId: 'event_2026_09',
    },
    {
      resolveSelfAthlete: async () => ({ id: 'athlete_1' }),
      resolveEligibleTestEvent: async (testEventId, athleteId) =>
        testEventId === 'event_2026_09' && athleteId === 'athlete_1'
          ? { id: testEventId }
          : null,
      insert: evidence => {
        inserted.push(evidence)
        return { ...evidence, isDeleted: false }
      },
      newId: () => 'official_athlete_test_1',
      now: () => '2026-09-24T15:00:00.000Z',
    },
  )

  assert.equal(result.success, true)
  assert.equal(inserted[0]?.testEventId, 'event_2026_09')
  assert.equal(inserted[0]?.executionContext, 'official')
  assert.equal(inserted[0]?.recordedBy, 'athlete')
  assert.equal(inserted[0]?.reviewStatus, 'accepted')
})

test('athlete cannot claim an unavailable official TestEvent', async () => {
  let insertCalls = 0

  const result = await createAthleteTrack1000mEvidence(
    {
      athleteId: 'athlete_1',
      userId: 'user_athlete_1',
      performedAt: '2026-09-24',
      elapsedTimeSec: 299,
      executionContext: 'official',
      testEventId: 'other_team_event',
    },
    {
      resolveSelfAthlete: async () => ({ id: 'athlete_1' }),
      resolveEligibleTestEvent: async () => null,
      insert: evidence => {
        insertCalls += 1
        return { ...evidence, isDeleted: false }
      },
      newId: () => 'must_not_be_used',
      now: () => '2026-09-24T15:00:00.000Z',
    },
  )

  assert.deepEqual(result, { success: false, error: 'test_event_not_found' })
  assert.equal(insertCalls, 0)
})
