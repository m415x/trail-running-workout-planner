import assert from 'node:assert/strict'
import test from 'node:test'

import {
  defineAthleteAdministrativeIdentity,
  resolveAthleteAdministrativeIdentity,
} from '../../lib/athletes/administrative-identity'

test('KAN-601/T1 models a sports athlete without an EPT User or Auth identity', () => {
  const athlete = defineAthleteAdministrativeIdentity({
    athleteId: 'athlete-existing',
    teamId: 'team-a',
    userId: null,
    firstName: 'Ana',
    lastName: 'Acosta',
    contactEmail: null,
    phone: '+54 264 555',
  })

  assert.equal(athlete.userId, null)
  assert.equal(athlete.athleteId, 'athlete-existing')
  assert.equal(athlete.teamId, 'team-a')
  assert.equal(athlete.firstName, 'Ana')
  assert.equal(athlete.lastName, 'Acosta')
  assert.equal(athlete.contactEmail, null)
})

test('KAN-601/T1 preserves sport-owned administrative facts when EPT User is linked', () => {
  const athlete = defineAthleteAdministrativeIdentity({
    athleteId: 'athlete-existing',
    teamId: 'team-a',
    userId: 'ept-user-1',
    firstName: 'Ana',
    lastName: 'Acosta',
    contactEmail: 'sport-contact@example.test',
    phone: null,
  })

  const resolved = resolveAthleteAdministrativeIdentity(athlete, {
    id: 'ept-user-1',
    firstName: 'Account',
    lastName: 'Holder',
    email: 'login@example.test',
  })

  assert.equal(resolved.athleteId, athlete.athleteId)
  assert.equal(resolved.teamId, athlete.teamId)
  assert.equal(resolved.firstName, athlete.firstName)
  assert.equal(resolved.lastName, athlete.lastName)
  assert.equal(resolved.contactEmail, athlete.contactEmail)
  assert.equal(resolved.userId, 'ept-user-1')
})

test('KAN-601/T1 does not silently accept unrelated EPT User information', () => {
  const athlete = defineAthleteAdministrativeIdentity({
    athleteId: 'athlete-existing',
    teamId: 'team-a',
    userId: 'ept-user-1',
    firstName: 'Ana',
    lastName: 'Acosta',
    contactEmail: null,
    phone: null,
  })

  assert.throws(() => resolveAthleteAdministrativeIdentity(athlete, {
    id: 'another-user',
    firstName: 'Other',
    lastName: 'Person',
    email: 'other@example.test',
  }), /identity mismatch/)
})
