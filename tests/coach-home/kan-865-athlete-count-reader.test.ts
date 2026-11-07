import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCoachHomeAthleteCountReader } from '@/lib/coach-home/athlete-count-reader'

type Context =
  | { status: 'resolved'; actorId: string; teamId: string }
  | { status: 'denied' | 'selection_required' | 'invalid_context' | 'error' }

type Athlete = { id: string; teamId: string; isActive: boolean; isDeleted: boolean }

function scenario(input: {
  context: Context
  allowed?: boolean
  athletes?: Athlete[]
  failRead?: boolean
}) {
  const effects = { authorizations: 0, reads: 0, writes: 0 }
  const reader = createCoachHomeAthleteCountReader({
    resolveContext: async () => input.context,
    authorize: async () => {
      effects.authorizations++
      return input.allowed ?? false
    },
    countActive: async (teamId: string) => {
      effects.reads++
      if (input.failRead) throw new Error('persistence unavailable')
      return (input.athletes ?? []).filter((athlete) => (
        athlete.teamId === teamId && athlete.isActive && !athlete.isDeleted
      )).length
    },
  })
  return { reader, effects }
}

describe('KAN-865/T2 Coach Home athlete count authority and states', () => {
  const athletes: Athlete[] = [
    { id: 'a', teamId: 'team_A', isActive: true, isDeleted: false },
    { id: 'b', teamId: 'team_A', isActive: true, isDeleted: false },
    { id: 'inactive', teamId: 'team_A', isActive: false, isDeleted: false },
    { id: 'deleted', teamId: 'team_A', isActive: true, isDeleted: true },
    { id: 'foreign', teamId: 'team_B', isActive: true, isDeleted: false },
  ]

  it('counts only active nondeleted profiles of the authenticated authorized Team', async () => {
    const a = scenario({ context: { status: 'resolved', actorId: 'coach', teamId: 'team_A' }, allowed: true, athletes })
    const b = scenario({ context: { status: 'resolved', actorId: 'coach', teamId: 'team_B' }, allowed: true, athletes })
    assert.deepEqual(await a.reader.read(), { status: 'ready', count: 2 })
    assert.deepEqual(await b.reader.read(), { status: 'ready', count: 1 })
    assert.deepEqual(a.effects, { authorizations: 1, reads: 1, writes: 0 })
  })

  it('preserves empty as a genuine authorized count of zero', async () => {
    const s = scenario({ context: { status: 'resolved', actorId: 'coach', teamId: 'team_B' }, allowed: true })
    assert.deepEqual(await s.reader.read(), { status: 'empty', count: 0 })
  })

  it('fails closed before reading on H2/H3 DENY or missing Team selection', async () => {
    for (const status of ['denied', 'selection_required', 'invalid_context'] as const) {
      const s = scenario({ context: { status } })
      assert.deepEqual(await s.reader.read(), { status })
      assert.deepEqual(s.effects, { authorizations: 0, reads: 0, writes: 0 })
    }
    const denied = scenario({ context: { status: 'resolved', actorId: 'coach', teamId: 'team_A' }, allowed: false, athletes })
    assert.deepEqual(await denied.reader.read(), { status: 'denied' })
    assert.deepEqual(denied.effects, { authorizations: 1, reads: 0, writes: 0 })
  })

  it('distinguishes operational error from DENY and genuine empty', async () => {
    const s = scenario({ context: { status: 'resolved', actorId: 'coach', teamId: 'team_A' }, allowed: true, failRead: true })
    assert.deepEqual(await s.reader.read(), { status: 'error' })
    assert.deepEqual(s.effects, { authorizations: 1, reads: 1, writes: 0 })
    const preflight = scenario({ context: { status: 'error' } })
    assert.deepEqual(await preflight.reader.read(), { status: 'error' })
  })
})
