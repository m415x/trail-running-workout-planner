import assert from 'node:assert/strict'
import test from 'node:test'

import { createAuthorizedCompetitionCalendarWriter } from '@/lib/periodization/authorized-competition-calendar-writer'

type Deps = Parameters<typeof createAuthorizedCompetitionCalendarWriter>[0]
type Access = Awaited<ReturnType<Deps['readAccess']>>
type Team = Awaited<ReturnType<Deps['resolveActiveTeam']>>

const authenticated: Access = { status: 'authenticated', provider: 'supabase', subject: 'subject_coach_a', userId: 'coach_a' }
const resolved = (teamId: string): Team => ({ status: 'resolved', teamId, source: 'single_membership' })

function harness(options: {
  access?: Access
  team?: Team
  ownerTeamId?: string | null
  permitted?: boolean
  authorizedTeamId?: string
} = {}) {
  const calls = { read: 0, team: 0, lookup: 0, authorization: 0, writes: 0 }
  const database = {
    select: () => {
      calls.lookup++
      return {
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              get: () => options.ownerTeamId === null ? undefined : { teamId: options.ownerTeamId ?? 'team_a' },
            }),
          }),
        }),
      }
    },
  } as unknown as Deps['database']
  const writer = createAuthorizedCompetitionCalendarWriter({
    database,
    async readAccess() { calls.read++; return options.access ?? authenticated },
    async resolveActiveTeam(userId) {
      calls.team++
      assert.equal(userId, 'coach_a')
      return options.team ?? resolved('team_a')
    },
    async authorize(access, request) {
      calls.authorization++
      assert.deepEqual(access, { status: 'authenticated', userId: 'coach_a' })
      assert.equal(request.capability, 'competition.manage')
      assert.deepEqual(request.resource, { teamId: 'team_a' })
      assert.equal(request.requiredScope, 'team')
      assert.equal(request.at, '2026-10-19T12:00:00.000Z')
      return { allowed: options.permitted ?? true, teamId: options.authorizedTeamId ?? 'team_a' }
    },
    now: () => '2026-10-19T12:00:00.000Z',
  })
  return { writer, calls }
}

test('KAN-827 authentic Coach with active Team, owned Plan and effective TEAM capability is allowed', async () => {
  const { writer, calls } = harness()
  assert.deepEqual(await writer.authorizePlan('plan_a'), { status: 'allowed', teamId: 'team_a' })
  assert.equal(calls.authorization, 1)
  assert.equal(calls.writes, 0)
})

test('KAN-827 anonymous, invalid and unlinked EPT identity fail closed before Team and database lookup', async () => {
  const deniedIdentities: Access[] = [
    { status: 'anonymous' },
    { status: 'invalid' },
    { status: 'unlinked', provider: 'supabase', subject: 'subject_unlinked' },
  ]
  for (const access of deniedIdentities) {
    const { writer, calls } = harness({ access })
    assert.deepEqual(await writer.authorizePlan('plan_a'), { status: 'denied' })
    assert.equal(calls.team, 0)
    assert.equal(calls.lookup, 0)
    assert.equal(calls.authorization, 0)
  }
})

test('KAN-827 ambiguous or revoked Team context fails closed without Plan lookup or authorization', async () => {
  for (const team of [{ status: 'selection_required' }, { status: 'invalid_context' }] as Team[]) {
    const { writer, calls } = harness({ team })
    assert.deepEqual(await writer.authorizePlan('plan_a'), { status: 'denied' })
    assert.equal(calls.lookup, 0)
    assert.equal(calls.authorization, 0)
  }
})

test('KAN-827 missing Plan or Plan from another Team is denied without consulting capability', async () => {
  for (const ownerTeamId of [null, 'team_b']) {
    const { writer, calls } = harness({ ownerTeamId })
    assert.deepEqual(await writer.authorizePlan('plan_a'), { status: 'denied' })
    assert.equal(calls.authorization, 0)
  }
})

test('KAN-827 missing effective permission or mismatched authorization Team fails closed', async () => {
  for (const options of [{ permitted: false }, { authorizedTeamId: 'team_b' }]) {
    const { writer, calls } = harness(options)
    assert.deepEqual(await writer.authorizePlan('plan_a'), { status: 'denied' })
    assert.equal(calls.authorization, 1)
    assert.equal(calls.writes, 0)
  }
})
