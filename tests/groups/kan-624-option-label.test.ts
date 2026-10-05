import assert from 'node:assert/strict'
import test from 'node:test'

import { getGroupMemberOptionName } from '../../features/groups/lib/group-member-option-label'

const base = {
  teamId: 'team-1',
  contactEmail: null,
  phone: null,
}

test('KAN-624 option labels prefer AthleteProfile, allow legitimate User fallback and keep missing names distinguishable', () => {
  assert.equal(getGroupMemberOptionName({
    ...base, id: 'ath-profile', userId: null,
    firstName: 'Ana', lastName: 'Perfil', user: null,
  }), 'Perfil, Ana')

  assert.equal(getGroupMemberOptionName({
    ...base, id: 'ath-legacy', userId: 'user-1',
    firstName: null, lastName: null,
    user: { id: 'user-1', firstName: 'Ana', lastName: 'Legado', email: 'ana@example.test' },
  }), 'Legado, Ana')

  assert.equal(getGroupMemberOptionName({
    ...base, id: 'ath-missing', userId: null,
    firstName: null, lastName: null, user: null,
  }), '— (ath-missing)')
})
