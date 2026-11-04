import assert from 'node:assert/strict'
import test from 'node:test'

import { selectCoachHomeNextCompetition } from '@/lib/coach-home/next-competition'

type Entry = {
  id: string
  groupTrainingPlanId: string
  name: string
  date: string
  status: 'planned' | 'confirmed' | 'completed' | 'cancelled'
  priority: 'A' | 'B' | 'C'
  distanceKm: number
  isDeleted: boolean
}
const entry = (id: string, planId: string, date: string, status: Entry['status'] = 'planned'): Entry => ({
  id, groupTrainingPlanId: planId, name: id, date, status, priority: 'B', distanceKm: 20, isDeleted: false,
})

test('KAN-867/T4 selects earliest real upcoming Plan-owned Competition from authorized Plan IDs', () => {
  const selected = selectCoachHomeNextCompetition({
    planning: { status: 'ready', authorizedPlanIds: ['plan_A', 'plan_variant'] },
    calendar: {
      status: 'ready', entries: [
        entry('future_later', 'plan_A', '2026-12-02'),
        entry('cancelled', 'plan_A', '2026-11-04', 'cancelled'),
        entry('completed', 'plan_A', '2026-11-04', 'completed'),
        entry('foreign', 'plan_foreign', '2026-11-04'),
        entry('today', 'plan_variant', '2026-11-04', 'confirmed'),
        entry('past', 'plan_A', '2026-11-03'),
      ],
    },
    today: '2026-11-04',
  })
  assert.equal(selected.status, 'ready')
  if (selected.status !== 'ready') throw Error('expected next Competition')
  assert.equal(selected.competition.id, 'today')
  assert.equal(selected.competition.groupTrainingPlanId, 'plan_variant')
})

test('KAN-867/T4 does not invent a next Competition from catalog-only or excluded entries', () => {
  assert.deepEqual(selectCoachHomeNextCompetition({
    planning: { status: 'ready', authorizedPlanIds: ['own'] },
    calendar: { status: 'ready', entries: [entry('foreign', 'other', '2026-11-05'), entry('cancelled', 'own', '2026-11-06', 'cancelled')] },
    today: '2026-11-04',
  }), { status: 'empty' })
})

test('KAN-867/T4 preserves authorization and operational errors instead of treating them as empty', () => {
  for (const status of ['denied', 'selection_required', 'invalid_context', 'error'] as const) {
    assert.deepEqual(selectCoachHomeNextCompetition({
      planning: { status }, calendar: { status: 'ready', entries: [] }, today: '2026-11-04',
    }), { status })
  }
  assert.deepEqual(selectCoachHomeNextCompetition({
    planning: { status: 'ready', authorizedPlanIds: ['own'] },
    calendar: { status: 'error' },
    today: '2026-11-04',
  }), { status: 'error' })
})

test('KAN-867/T4 deterministic tie break and deleted records remain excluded', () => {
  const result = selectCoachHomeNextCompetition({
    planning: { status: 'ready', authorizedPlanIds: ['plan_B', 'plan_A'] },
    calendar: {
      status: 'ready', entries: [
        entry('z', 'plan_B', '2026-11-10'),
        { ...entry('deleted', 'plan_A', '2026-11-08'), isDeleted: true },
        entry('a', 'plan_A', '2026-11-10'),
      ],
    },
    today: '2026-11-04',
  })
  assert.equal(result.status, 'ready')
  if (result.status === 'ready') assert.equal(result.competition.id, 'a')
})
