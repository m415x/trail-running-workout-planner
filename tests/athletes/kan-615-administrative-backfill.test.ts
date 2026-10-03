import assert from 'node:assert/strict'
import test from 'node:test'

import { planAthleteAdministrativeBackfill } from '../../lib/athletes/administrative-backfill'

test('KAN-615 backfills only a real foreign-key-linked EPT user', () => {
  const result = planAthleteAdministrativeBackfill({
    athlete: {
      id: 'ath-1', userId: 'user-1', firstName: null, lastName: null, contactEmail: null,
    },
    linkedUser: {
      id: 'user-1', firstName: 'Ana', lastName: 'Acosta', email: 'ana@example.test',
    },
  })

  assert.deepEqual(result, {
    athleteId: 'ath-1',
    changes: {
      firstName: 'Ana',
      lastName: 'Acosta',
      contactEmail: 'ana@example.test',
    },
  })
})

test('KAN-615 never overwrites reviewed sport-owned values on rerun', () => {
  const result = planAthleteAdministrativeBackfill({
    athlete: {
      id: 'ath-2', userId: 'user-2', firstName: 'Ana María',
      lastName: 'Acosta', contactEmail: 'contact@example.test',
    },
    linkedUser: {
      id: 'user-2', firstName: 'Ana', lastName: 'Account', email: 'auth@example.test',
    },
  })
  assert.deepEqual(result, { athleteId: 'ath-2', changes: {} })
})

test('KAN-615 does not match unlinked athletes by name, DNI or email', () => {
  const result = planAthleteAdministrativeBackfill({
    athlete: {
      id: 'ath-3', userId: null, firstName: null, lastName: null, contactEmail: null,
    },
    linkedUser: {
      id: 'user-3', firstName: 'Same', lastName: 'Name', email: 'same@example.test',
    },
  })
  assert.deepEqual(result, { athleteId: 'ath-3', changes: {} })
})

test('KAN-615 rejects a contradictory linked foreign key', () => {
  assert.throws(() => planAthleteAdministrativeBackfill({
    athlete: {
      id: 'ath-4', userId: 'user-a', firstName: null, lastName: null, contactEmail: null,
    },
    linkedUser: {
      id: 'user-b', firstName: 'Wrong', lastName: 'User', email: 'wrong@example.test',
    },
  }), /identity mismatch/i)
})
