import assert from 'node:assert/strict'
import test from 'node:test'

import { createH6TermsAndMaterializationActions } from '@/lib/memberships/h6-terms-materialization-actions'

const at = '2026-10-09T12:00:00.000Z'
const access = { status: 'authenticated' as const, userId: 'coach_a' }
const denied = { allowed: false as const }
const allowed = { allowed: true as const, teamId: 'team_a' }

function fixture(decision: typeof denied | typeof allowed = allowed) {
  const writes: string[] = []
  const revalidations: string[] = []
  const capabilities: string[] = []
  const actions = createH6TermsAndMaterializationActions({
    authenticate: async () => access,
    authorize: async (_access, request) => {
      capabilities.push(request.capability)
      return decision
    },
    ownsAthlete: async (teamId, athleteId) => teamId === 'team_a' && athleteId === 'athlete_a',
    initializeTerms: async (teamId, athleteId) => {
      writes.push('initial:' + teamId + ':' + athleteId)
      return { success: true as const }
    },
    changeTerms: async (teamId, athleteId) => {
      writes.push('change:' + teamId + ':' + athleteId)
      return { success: true as const }
    },
    materialize: async (teamId) => {
      writes.push('materialize:' + teamId)
      return { success: true as const, processedAthletes: 1, materializedCharges: 1 }
    },
    revalidate: (path) => { revalidations.push(path) },
    now: () => at,
  })
  return { actions, writes, revalidations, capabilities }
}

test('KAN-717 permits only economy.manage for owned initial terms, replacement and bulk materialization', async () => {
  const h = fixture()
  assert.equal((await h.actions.applyInitial({ athleteId: 'athlete_a', effectiveFrom: '2026-10-09', locale: 'es' })).success, true)
  assert.equal((await h.actions.change({ athleteId: 'athlete_a', effectiveFrom: '2026-11-01', monthlyAmountMinor: 2000000, currency: 'ARS', locale: 'en' })).success, true)
  assert.equal((await h.actions.materialize({ year: 2026, month: 10, locale: 'es' })).success, true)
  assert.deepEqual(h.capabilities, ['economy.manage', 'economy.manage', 'economy.manage'])
  assert.deepEqual(h.writes, ['initial:team_a:athlete_a', 'change:team_a:athlete_a', 'materialize:team_a'])
  assert.equal(h.revalidations.length, 3)
})

test('KAN-717 denies without any write/revalidation and checks AthleteProfile ownership', async () => {
  const deniedFixture = fixture(denied)
  assert.equal((await deniedFixture.actions.applyInitial({ athleteId: 'athlete_a', effectiveFrom: '2026-10-09', locale: 'es' })).success, false)
  assert.equal((await deniedFixture.actions.change({ athleteId: 'athlete_a', effectiveFrom: '2026-11-01', monthlyAmountMinor: 2000000, currency: 'ARS', locale: 'es' })).success, false)
  assert.equal((await deniedFixture.actions.materialize({ year: 2026, month: 10, locale: 'es' })).success, false)
  assert.deepEqual(deniedFixture.writes, [])
  assert.deepEqual(deniedFixture.revalidations, [])

  const crossTeam = fixture()
  assert.equal((await crossTeam.actions.change({ athleteId: 'athlete_b', effectiveFrom: '2026-11-01', monthlyAmountMinor: 2000000, currency: 'ARS', locale: 'es' })).success, false)
  assert.deepEqual(crossTeam.writes, [])
  assert.deepEqual(crossTeam.revalidations, [])
})
