import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getCompetitionRole,
  resolvePrimaryCompetitionCandidate,
} from '@/lib/periodization/competition-priority'
import type { CompetitionEntry } from '@/types/training/competition-entry.types'

function competition(
  id: string,
  priority: CompetitionEntry['priority'],
): CompetitionEntry {
  return {
    id,
    groupTrainingPlanId: 'plan-1',
    name: `Competition ${id}`,
    date: '2027-04-12',
    distanceKm: 42,
    elevationGainM: 1200,
    priority,
    status: 'scheduled',
    description: null,
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
  }
}

test('maps A, B and C to distinct planning roles', () => {
  assert.equal(getCompetitionRole('A'), 'primary_candidate')
  assert.equal(getCompetitionRole('B'), 'preparatory')
  assert.equal(getCompetitionRole('C'), 'secondary')
})

test('resolves the single A entry as the primary candidate', () => {
  const primary = competition('a', 'A')
  const result = resolvePrimaryCompetitionCandidate([
    competition('b', 'B'),
    primary,
    competition('c', 'C'),
  ])

  assert.deepEqual(result, { valid: true, primaryCandidate: primary })
})

test('returns no primary candidate when the scoped calendar has only B/C entries', () => {
  const result = resolvePrimaryCompetitionCandidate([
    competition('b', 'B'),
    competition('c', 'C'),
  ])

  assert.deepEqual(result, { valid: true, primaryCandidate: null })
})

test('rejects multiple A candidates in the same scoped macrocycle context', () => {
  const result = resolvePrimaryCompetitionCandidate([
    competition('a-1', 'A'),
    competition('a-2', 'A'),
  ])

  assert.deepEqual(result, {
    valid: false,
    errors: ['competition_priority_multiple_primary_candidates'],
  })
})
