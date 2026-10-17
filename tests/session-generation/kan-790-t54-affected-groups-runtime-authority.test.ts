import assert from 'node:assert/strict'
import test from 'node:test'

import { authorizeReviewSnapshotAffectedGroupSet } from '@/lib/session-generation/authorized-review-snapshot-affected-group-set'

function fixture(options: { activeTeam?: string; deniedGroup?: string; foreignGroup?: string } = {}) {
  const calls: string[] = []
  const groups = ['group-base', 'group-shared']
  const dependencies = {
    ownerUserId: 'coach',
    ownerTeamId: 'team-a',
    groupIds: groups,
    resolveActor: async () => {
      calls.push('actor')
      return { userId: 'coach', teamId: options.activeTeam ?? 'team-a' }
    },
    readGroup: async (id: string) => {
      calls.push('read:' + id)
      return { id, teamId: id === options.foreignGroup ? 'team-b' : 'team-a' }
    },
    authorizeGroup: async (_actor: { userId: string; teamId: string }, id: string) => {
      calls.push('authorize:' + id)
      return id !== options.deniedGroup
    },
  }
  return { dependencies, calls }
}

test('KAN-790 T5.4 runtime allows both current and shared Sporting Groups only with current actor and H4A', async () => {
  const { dependencies, calls } = fixture()
  const granted = await authorizeReviewSnapshotAffectedGroupSet(dependencies)
  assert.deepEqual([...granted ?? []].sort(), ['group-base', 'group-shared'])
  assert.deepEqual(calls, ['actor', 'read:group-base', 'authorize:group-base',
    'read:group-shared', 'authorize:group-shared'])
})

test('KAN-790 T5.4 runtime DENY if planning.manage on shared group is revoked', async () => {
  const { dependencies, calls } = fixture({ deniedGroup: 'group-shared' })
  assert.equal(await authorizeReviewSnapshotAffectedGroupSet(dependencies), null)
  assert.deepEqual(calls, ['actor', 'read:group-base', 'authorize:group-base',
    'read:group-shared', 'authorize:group-shared'])
})

test('KAN-790 T5.4 runtime DENY on active Team drift before any group H4A evaluation', async () => {
  const { dependencies, calls } = fixture({ activeTeam: 'team-b' })
  assert.equal(await authorizeReviewSnapshotAffectedGroupSet(dependencies), null)
  assert.deepEqual(calls, ['actor'])
})

test('KAN-790 T5.4 runtime DENY when an affected group belongs to another Team', async () => {
  const { dependencies, calls } = fixture({ foreignGroup: 'group-shared' })
  assert.equal(await authorizeReviewSnapshotAffectedGroupSet(dependencies), null)
  assert.deepEqual(calls, ['actor', 'read:group-base', 'authorize:group-base',
    'read:group-shared'])
})
