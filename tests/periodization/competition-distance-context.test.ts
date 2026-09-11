import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assessCompetitionDistance,
  withCompetitionDistanceCompatibility,
} from '@/lib/periodization/competition-distance-context'
import type { CompetitionEntry } from '@/types/training/competition-entry.types'

function competition(distanceKm: number): CompetitionEntry {
  return {
    id: `competition-${distanceKm}`,
    groupTrainingPlanId: 'plan-1',
    name: 'Race',
    date: '2026-11-15',
    distanceKm,
    elevationGainM: null,
    priority: 'B',
    status: 'planned',
    description: null,
    isDeleted: false,
    createdAt: '2026-09-10T12:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
  }
}

test('derives compatibility from CompetitionEntry.distanceKm', () => {
  const result = assessCompetitionDistance('H', competition(21))

  assert.equal(result.status, 'compatible')
  assert.equal(result.blocking, false)
})

test('keeps incompatible competition distance advisory', () => {
  const result = assessCompetitionDistance('S', competition(42))

  assert.equal(result.status, 'incompatible')
  assert.equal(result.blocking, false)
  if (result.status === 'incompatible') {
    assert.equal(result.direction, 'above_maximum')
  }
})

test('preserves Elite as unrestricted and Base as pending policy', () => {
  assert.equal(assessCompetitionDistance('E', competition(100)).status, 'unrestricted')
  assert.equal(assessCompetitionDistance('B', competition(8)).status, 'policy_not_defined')
})

test('enriches calendar entries without mutating or persisting compatibility', () => {
  const source = [competition(10), competition(12)]
  const result = withCompetitionDistanceCompatibility('S', source)

  assert.equal(result.length, 2)
  assert.equal(result[0].distanceCompatibility.status, 'compatible')
  assert.equal(result[1].distanceCompatibility.status, 'compatible')
  assert.equal('distanceCompatibility' in source[0], false)
  assert.notEqual(result[0], source[0])
})
