import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCoachPlanningListReader } from '@/lib/planning/coach-planning-list-reader'

type Plan = { id: string; teamId: string; groupId: string }
type Context =
  | { status: 'resolved'; actorId: string; teamId: string }
  | { status: 'denied' }
  | { status: 'error' }

function scenario(input: {
  context: Context
  listingAllowed?: boolean
  plans?: Plan[]
  planAllowed?: (plan: Plan) => boolean
  throwOnLoad?: boolean
}) {
  let reads = 0
  let writes = 0
  let listAuthorizationChecks = 0
  let planAuthorizationChecks = 0

  const reader = createCoachPlanningListReader<Plan>({
    resolveContext: async () => input.context,
    authorizeListing: async () => {
      listAuthorizationChecks++
      return input.listingAllowed ?? false
    },
    loadPlans: async () => {
      reads++
      if (input.throwOnLoad) throw new Error('database unavailable')
      return input.plans ?? []
    },
    authorizePlan: async (_context, plan) => {
      planAuthorizationChecks++
      return input.planAllowed?.(plan) ?? false
    },
  })

  return {
    reader,
    counts: () => ({ reads, writes, listAuthorizationChecks, planAuthorizationChecks }),
    // Deliberately no mutation dependency exposed to the reader.
    markUnexpectedMutation: () => { writes++ },
  }
}

describe('KAN-696/T1 discriminated Coach planning list reader RED', () => {
  it('returns denied before reading plans for an actor without planning.manage', async () => {
    const s = scenario({
      context: { status: 'resolved', actorId: 'athlete', teamId: 'team_1' },
      listingAllowed: false,
      plans: [{ id: 'plan_1', teamId: 'team_1', groupId: 'group_1' }],
    })
    assert.deepEqual(await s.reader.read(), { status: 'denied' })
    assert.deepEqual(s.counts(), { reads: 0, writes: 0, listAuthorizationChecks: 1, planAuthorizationChecks: 0 })
  })

  it('returns empty for an authorized Coach with no groups or plans', async () => {
    const s = scenario({
      context: { status: 'resolved', actorId: 'coach', teamId: 'team_1' },
      listingAllowed: true,
      plans: [],
    })
    assert.deepEqual(await s.reader.read(), { status: 'empty' })
    assert.equal(s.counts().listAuthorizationChecks, 1)
    assert.equal(s.counts().writes, 0)
  })

  it('returns ready with only authorized same-Team plans', async () => {
    const own = { id: 'own', teamId: 'team_1', groupId: 'group_1' }
    const wrongTeam = { id: 'foreign', teamId: 'team_2', groupId: 'group_2' }
    const wrongScope = { id: 'uncovered', teamId: 'team_1', groupId: 'group_3' }
    const s = scenario({
      context: { status: 'resolved', actorId: 'coach', teamId: 'team_1' },
      listingAllowed: true,
      plans: [own, wrongTeam, wrongScope],
      planAllowed: (plan) => plan.id === 'own',
    })
    assert.deepEqual(await s.reader.read(), { status: 'ready', plans: [own] })
    assert.equal(s.counts().writes, 0)
  })

  it('preserves H3 unresolved/denied separately from operational error', async () => {
    for (const context of [{ status: 'denied' }, { status: 'error' }] as const) {
      const s = scenario({ context })
      assert.deepEqual(await s.reader.read(), { status: context.status })
      assert.equal(s.counts().reads, 0)
      assert.equal(s.counts().writes, 0)
    }
  })

  it('returns error instead of denied or empty when persistence fails', async () => {
    const s = scenario({
      context: { status: 'resolved', actorId: 'coach', teamId: 'team_1' },
      listingAllowed: true,
      throwOnLoad: true,
    })
    assert.deepEqual(await s.reader.read(), { status: 'error' })
    assert.equal(s.counts().writes, 0)
  })
})
