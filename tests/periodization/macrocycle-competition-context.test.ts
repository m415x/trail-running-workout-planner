import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveMacrocycleCompetitionContext,
  scopeCompetitionEntriesToMacrocycle,
} from '@/lib/periodization/macrocycle-competition-context'
import type { CompetitionEntry, Macrocycle } from '@/types'

function macrocycle(overrides: Partial<Macrocycle> = {}): Macrocycle {
  return {
    id: 'macro-1',
    groupTrainingPlanId: 'plan-1',
    title: 'Macrocycle',
    startDate: '2026-09-01',
    endDate: '2026-11-30',
    targetRaceName: 'Legacy Race',
    targetRaceDate: '2026-11-30',
    targetRaceDistanceKm: 42,
    targetRaceElevationGain: 1600,
    ...overrides,
  }
}

function competition(overrides: Partial<CompetitionEntry> = {}): CompetitionEntry {
  return {
    id: 'competition-a',
    groupTrainingPlanId: 'plan-1',
    name: 'Current Race',
    date: '2026-11-15',
    distanceKm: 50,
    elevationGainM: 2100,
    priority: 'A',
    status: 'confirmed',
    description: null,
    isDeleted: false,
    createdAt: '2026-09-11T12:00:00.000Z',
    updatedAt: '2026-09-11T12:00:00.000Z',
    ...overrides,
  }
}

test('scopes plan competitions to the selected macrocycle horizon', () => {
  const result = scopeCompetitionEntriesToMacrocycle([
    competition({ id: 'before', date: '2026-08-31' }),
    competition({ id: 'start', date: '2026-09-01' }),
    competition({ id: 'end', date: '2026-11-30' }),
    competition({ id: 'after', date: '2026-12-01' }),
  ], macrocycle())

  assert.deepEqual(result.map(({ id }) => id), ['start', 'end'])
})

test('uses an applicable live competition instead of the legacy snapshot', () => {
  const result = resolveMacrocycleCompetitionContext({
    competitionEntries: [competition()],
    macrocycle: macrocycle(),
  })

  assert.equal(result.valid, true)
  if (!result.valid) return

  assert.equal(result.source, 'competition_calendar')
  assert.equal(result.context.primaryCompetition?.name, 'Current Race')
})

test('allows legacy fallback when plan entries exist only outside this macrocycle', () => {
  const result = resolveMacrocycleCompetitionContext({
    competitionEntries: [competition({ date: '2026-12-20' })],
    macrocycle: macrocycle(),
  })

  assert.equal(result.valid, true)
  if (!result.valid) return

  assert.equal(result.source, 'legacy_snapshot')
  assert.equal(result.context.primaryCompetition?.name, 'Legacy Race')
})

test('does not revive legacy context when an in-horizon calendar row is cancelled', () => {
  const result = resolveMacrocycleCompetitionContext({
    competitionEntries: [competition({ status: 'cancelled' })],
    macrocycle: macrocycle(),
  })

  assert.equal(result.valid, true)
  if (!result.valid) return

  assert.equal(result.source, 'competition_calendar')
  assert.equal(result.context.primaryCompetition, null)
})
