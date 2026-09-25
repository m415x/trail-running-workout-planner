import assert from 'node:assert/strict'
import test from 'node:test'

import { createAthleteMembershipSnapshotReader } from '../../lib/memberships/athlete-membership-snapshot-reader'

test('reads athlete membership through the scoped persistence adapter', async () => {
  const calls: string[] = []

  const readSnapshot = createAthleteMembershipSnapshotReader({
    createPort: () => ({
      athleteBelongsToTeam: async (teamId, athleteId) => {
        calls.push(`belongs:${teamId}:${athleteId}`)
        return true
      },
      listBillingTerms: async (teamId, athleteId) => {
        calls.push(`terms:${teamId}:${athleteId}`)
        return []
      },
      listMonthlyCharges: async (teamId, athleteId) => {
        calls.push(`charges:${teamId}:${athleteId}`)
        return []
      },
      listTeamEconomicPolicies: async () => {
        throw new Error('policy read is not required for snapshot')
      },
      insertMonthlyCharges: async () => {
        throw new Error('snapshot read must not materialize charges')
      },
    }),
  })

  assert.deepEqual(
    await readSnapshot({
      db: {},
      teamId: 'team_1',
      athleteId: 'athlete-1',
    }),
    { terms: [], charges: [] },
  )

  assert.deepEqual(calls, [
    'belongs:team_1:athlete-1',
    'terms:team_1:athlete-1',
    'charges:team_1:athlete-1',
  ])
})

test('rejects cross-team athlete access before economic reads', async () => {
  let economicReads = 0

  const readSnapshot = createAthleteMembershipSnapshotReader({
    createPort: () => ({
      athleteBelongsToTeam: async () => false,
      listBillingTerms: async () => {
        economicReads += 1
        return []
      },
      listMonthlyCharges: async () => {
        economicReads += 1
        return []
      },
      listTeamEconomicPolicies: async () => [],
      insertMonthlyCharges: async () => undefined,
    }),
  })

  await assert.rejects(
    readSnapshot({
      db: {},
      teamId: 'team_1',
      athleteId: 'athlete-other-team',
    }),
    /does not belong to the requested team/,
  )
  assert.equal(economicReads, 0)
})
