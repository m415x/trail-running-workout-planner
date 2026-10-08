import assert from 'node:assert/strict'
import test from 'node:test'

import { createCoachNavigationProjection } from '@/lib/authorization/coach-navigation-projection'

test('KAN-691 computes Coach navigation from H2 actor, resolved active Team and effective H3 decisions', async () => {
  const calls: string[] = []
  const project = createCoachNavigationProjection({
    resolveActiveTeam: async (userId: string) => {
      assert.equal(userId, 'ept-user')
      return { status: 'resolved' as const, teamId: 'team-a', source: 'single_membership' as const }
    },
    authorize: async (access, request) => {
      assert.equal(access.status, 'authenticated')
      assert.equal(request.teamId, 'team-a')
      assert.deepEqual(request.resource, { teamId: 'team-a' })
      calls.push(request.capability)
      return { allowed: request.capability === 'planning.manage' },
    },
  })
  const result = await project({ status: 'authenticated', userId: 'ept-user' })
  assert.deepEqual(result, ['/dashboard', '/dashboard/cohorts', '/dashboard/planning', '/dashboard/sessions'])
  assert.deepEqual(calls.sort(), ['athlete.admin.manage', 'economic_policy.manage', 'planning.manage', 'sporting_group.admin.manage'].sort())
})

test('KAN-691 denies privileged entries when H2 is absent or active Team is ambiguous', async () => {
  let authorizeCalls = 0
  const project = createCoachNavigationProjection({
    resolveActiveTeam: async () => ({ status: 'selection_required' as const }),
    authorize: async () => { authorizeCalls++; return { allowed: true } },
  })
  assert.deepEqual(await project({ status: 'authenticated', userId: 'ept-user' }), ['/dashboard'])
  assert.deepEqual(await project({ status: 'unauthenticated' }), [])
  assert.equal(authorizeCalls, 0)
})

test('KAN-691 refuses to expose privileged links on H3 evidence errors', async () => {
  const project = createCoachNavigationProjection({
    resolveActiveTeam: async () => ({ status: 'resolved' as const, teamId: 'team-a', source: 'persisted' as const }),
    authorize: async () => { throw new Error('evidence unavailable') },
  })
  assert.deepEqual(await project({ status: 'authenticated', userId: 'ept-user' }), ['/dashboard'])
})
