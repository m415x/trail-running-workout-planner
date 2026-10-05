import assert from 'node:assert/strict'
import test from 'node:test'

import { sortPlanningCohortMembers } from '../../lib/planning-cohorts/member-order'

test('KAN-624 member ordering is administrative, null-last, newest-start-first and stable by membership id', () => {
  const members = [
    { id: 'm4', startDate: '2026-01-01', athleteProfile: { id: 'a4', teamId: 'team-1', userId: null, firstName: null, lastName: null, contactEmail: null, phone: null, user: null } },
    { id: 'm2', startDate: '2026-02-01', athleteProfile: { id: 'a2', teamId: 'team-1', userId: null, firstName: 'Ana', lastName: 'Acosta', contactEmail: null, phone: null, user: null } },
    { id: 'm1', startDate: '2026-03-01', athleteProfile: { id: 'a1', teamId: 'team-1', userId: null, firstName: 'Ana', lastName: 'Acosta', contactEmail: null, phone: null, user: null } },
    { id: 'm3', startDate: '2026-01-01', athleteProfile: { id: 'a3', teamId: 'team-1', userId: null, firstName: 'Bruno', lastName: 'Bravo', contactEmail: null, phone: null, user: null } },
  ]

  sortPlanningCohortMembers(members)
  assert.deepEqual(members.map(member => member.id), ['m1', 'm2', 'm3', 'm4'])
})
