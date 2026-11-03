import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { createCoachPlanningListReader } from '@/lib/planning/coach-planning-list-reader'
import { projectCoachHomePlanning } from '@/lib/coach-home/planning-summary'

const source = readFileSync('app/actions/coach-home-actions.ts', 'utf8')

test('KAN-866/T3 production entry delegates to existing H2/H3/H4A planning list and only then projects', () => {
  assert.match(source, /getCoachPlanningListResult\(\)/)
  assert.match(source, /projectCoachHomePlanning\(result, date\)/)
  assert.doesNotMatch(source, /CURRENT_TEAM_ID|team_1|\.query\.groupTrainingPlans/)
})

test('KAN-866/T3 authorized Plan reader filters Team and per-Plan grants before any Home projection', async () => {
  const effects = { loads: 0, authorizations: 0, writes: 0 }
  const plans = [
    { id: 'own', groupId: 'group_A', teamId: 'team_A', title: 'Own', status: 'active', sourceGroupTrainingPlanId: null, macrocycles: [] },
    { id: 'other-group', groupId: 'group_B', teamId: 'team_A', title: 'Other Group', status: 'active', sourceGroupTrainingPlanId: null, macrocycles: [] },
    { id: 'foreign', groupId: 'group_C', teamId: 'team_B', title: 'Foreign', status: 'active', sourceGroupTrainingPlanId: null, macrocycles: [] },
  ]
  const reader = createCoachPlanningListReader({
    resolveContext: async () => ({ status: 'resolved' as const, teamId: 'team_A', actorId: 'coach' }),
    authorizeListing: async () => { effects.authorizations++; return true },
    loadPlans: async () => { effects.loads++; return plans },
    authorizePlan: async (_context, plan) => plan.id === 'own',
  })
  const authorized = await reader.read()
  const projection = projectCoachHomePlanning(authorized, '2026-11-03')
  assert.equal(projection.status, 'ready')
  if (projection.status !== 'ready') throw Error('expected authorized summary')
  assert.deepEqual(projection.plans.map((plan) => plan.id), ['own'])
  assert.deepEqual(effects, { loads: 1, authorizations: 1, writes: 0 })

  const denied = createCoachPlanningListReader({
    resolveContext: async () => ({ status: 'resolved' as const, teamId: 'team_A', actorId: 'athlete' }),
    authorizeListing: async () => false,
    loadPlans: async () => { effects.loads++; return plans },
    authorizePlan: async () => true,
  })
  assert.deepEqual(projectCoachHomePlanning(await denied.read(), '2026-11-03'), { status: 'denied' })
  assert.equal(effects.loads, 1, 'DENY must prevent Plan read')
})
