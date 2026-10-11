import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveTrustedH7aAuthorship } from '@/lib/authorization/h7a-trusted-authorship'

test('KAN-727: trusted authorship comes only from authenticated H2 actor', () => {
  const result = resolveTrustedH7aAuthorship({ status: 'authenticated', userId: 'coach_a' })
  assert.deepEqual(result, {
    authenticatedActorUserId: 'coach_a',
    effectiveActorUserId: 'coach_a',
  })
})

test('KAN-727: denied H2 cannot produce authorship', () => {
  for (const reason of ['anonymous', 'unlinked', 'invalid'] as const) {
    assert.equal(resolveTrustedH7aAuthorship({ status: 'forbidden', reason }), null)
  }
})

test('KAN-727: H2 author is not overwritten by caller payload or target identity', () => {
  const access = { status: 'authenticated' as const, userId: 'coach_a' }
  const payload = { ...access, athleteId: 'athlete_b', coachUserId: 'spoofed_user' }
  assert.deepEqual(resolveTrustedH7aAuthorship(payload), {
    authenticatedActorUserId: 'coach_a',
    effectiveActorUserId: 'coach_a',
  })
})
