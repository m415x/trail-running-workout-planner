import assert from 'node:assert/strict'
import test from 'node:test'

import { deriveCompetitionContext } from '@/lib/periodization/competition-context'
import type { CompetitionEntry } from '@/types/training/competition-entry.types'

function competition(
  id: string,
  priority: CompetitionEntry['priority'],
  status: CompetitionEntry['status'] = 'planned',
  isDeleted = false,
): CompetitionEntry {
  return {
    id,
    groupTrainingPlanId: 'plan-1',
    name: `Race ${id}`,
    date: '2026-11-15',
    distanceKm: 21,
    elevationGainM: 900,
    priority,
    status,
    description: null,
    isDeleted,
    createdAt: '2026-09-10T12:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
  }
}

test('derives one active A competition as primary context', () => {
  const result = deriveCompetitionContext([
    competition('a', 'A'),
    competition('b', 'B'),
    competition('c', 'C'),
  ])

  assert.equal(result.valid, true)
  if (!result.valid) return

  assert.equal(result.context.primaryCompetition?.id, 'a')
  assert.deepEqual(
    result.context.intermediateCompetitions.map(({ id }) => id),
    ['b', 'c'],
  )
})

test('allows planning without a primary competition', () => {
  const result = deriveCompetitionContext([
    competition('b', 'B'),
    competition('c', 'C'),
  ])

  assert.equal(result.valid, true)
  if (!result.valid) return

  assert.equal(result.context.primaryCompetition, null)
  assert.equal(result.context.intermediateCompetitions.length, 2)
})

test('excludes completed, cancelled and logically deleted competitions', () => {
  const result = deriveCompetitionContext([
    competition('active-b', 'B', 'confirmed'),
    competition('completed-a', 'A', 'completed'),
    competition('cancelled-c', 'C', 'cancelled'),
    competition('deleted-a', 'A', 'planned', true),
  ])

  assert.equal(result.valid, true)
  if (!result.valid) return

  assert.equal(result.context.primaryCompetition, null)
  assert.deepEqual(
    result.context.intermediateCompetitions.map(({ id }) => id),
    ['active-b'],
  )
})

test('rejects multiple active A candidates in one already-scoped horizon', () => {
  const result = deriveCompetitionContext([
    competition('a1', 'A'),
    competition('a2', 'A', 'confirmed'),
  ])

  assert.equal(result.valid, false)
  if (result.valid) return

  assert.deepEqual(result.errors, ['competition_context_multiple_primary_candidates'])
})

test('returns a detached context projection without mutating entries', () => {
  const source = competition('a', 'A')
  const result = deriveCompetitionContext([source])

  assert.equal(result.valid, true)
  if (!result.valid) return

  assert.notEqual(result.context.primaryCompetition, source)
  assert.equal('status' in (result.context.primaryCompetition ?? {}), false)
  assert.equal(source.status, 'planned')
  assert.equal(result.context.primaryCompetition?.elevationGain, 900)
})
