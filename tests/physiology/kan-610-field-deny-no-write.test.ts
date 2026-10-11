import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createCoachTrack1000mEvidence,
  correctTrack1000mEvidence,
  reviewCoachTrack1000mEvidence,
} from '../../lib/physiology/field-performance-test-application'

test('KAN-732 denied coach scopes never reach 1000m persistence', async () => {
  let reads = 0
  let writes = 0
  const deny = async () => null
  const forbiddenRead = () => { reads++; throw new Error('read after DENY') }
  const forbiddenWrite = () => { writes++; throw new Error('write after DENY') }
  const base = {
    resolveOwnedAthlete: deny,
    getById: forbiddenRead,
    resolveEligibleTestEvent: forbiddenRead,
    findActiveOfficialByAthleteAndTestEvent: forbiddenRead,
    insert: forbiddenWrite,
    replace: forbiddenWrite,
    review: forbiddenWrite,
    now: () => '2026-10-10T12:00:00.000Z',
    newId: () => 'not-used',
    recordedByUserId: 'actor',
    reviewedByUserId: 'actor',
  }
  const create = await createCoachTrack1000mEvidence({
    athleteId: 'other-team-athlete',
    testEventId: 'not-owned',
    performedAt: '2026-10-10',
    elapsedTimeSec: 300,
  }, base as never)
  const correct = await correctTrack1000mEvidence({
    athleteId: 'other-team-athlete',
    evidenceId: 'not-owned',
    replacement: {} as never,
  }, base as never)
  const review = await reviewCoachTrack1000mEvidence({
    athleteId: 'other-team-athlete',
    evidenceId: 'not-owned',
    reviewStatus: 'accepted',
  }, base as never)
  for (const result of [create, correct, review]) {
    assert.deepEqual(result, { success: false, error: 'athlete_not_found' })
  }
  assert.equal(reads, 0)
  assert.equal(writes, 0)
})
