import assert from 'node:assert/strict'
import test from 'node:test'

import { projectAthleteAdministrativeRead } from '../../lib/athletes/administrative-read-model'

test('KAN-622 preserves profile-owned name and contact for an unlinked athlete', () => {
  const view = projectAthleteAdministrativeRead({
    id: 'athlete-1', teamId: 'team-1', userId: null,
    firstName: 'Ana', lastName: 'Acosta', contactEmail: null, phone: '264-111',
    user: null,
  })
  assert.equal(view.athleteId, 'athlete-1')
  assert.equal(view.teamId, 'team-1')
  assert.equal(view.userId, null)
  assert.deepEqual(view.name, { firstName: 'Ana', lastName: 'Acosta', source: 'athlete_profile' })
  assert.deepEqual(view.email, { value: null, source: 'athlete_profile' })
})

test('KAN-622 reads legacy User names without claiming they are athlete-owned facts', () => {
  const view = projectAthleteAdministrativeRead({
    id: 'athlete-legacy', teamId: 'team-1', userId: 'user-1',
    firstName: null, lastName: null, contactEmail: null, phone: null,
    user: { id: 'user-1', firstName: 'Bruno', lastName: 'López', email: 'b@example.test' },
  })
  assert.deepEqual(view.name, { firstName: 'Bruno', lastName: 'López', source: 'legacy_user' })
  assert.deepEqual(view.email, { value: 'b@example.test', source: 'legacy_user' })
})

test('KAN-622 rejects unrelated identity and never invents missing names', () => {
  assert.throws(() => projectAthleteAdministrativeRead({
    id: 'athlete-2', teamId: 'team-1', userId: 'user-1',
    firstName: null, lastName: null, contactEmail: null, phone: null,
    user: { id: 'user-2', firstName: 'Wrong', lastName: 'Account', email: 'wrong@example.test' },
  }), /identity mismatch/i)
  const view = projectAthleteAdministrativeRead({
    id: 'athlete-3', teamId: 'team-1', userId: null,
    firstName: null, lastName: null, contactEmail: null, phone: null, user: null,
  })
  assert.equal(view.name, null)
  assert.deepEqual(view.email, { value: null, source: 'missing' })
})
