import assert from 'node:assert/strict'
import test from 'node:test'

import {
  adaptLegacyTargetRaceSnapshot,
  resolveCompetitionContext,
} from '@/lib/periodization/legacy-competition-context'
import type { CompetitionEntry, Macrocycle } from '@/types'

function macrocycle(
  overrides: Partial<Macrocycle> = {},
): Macrocycle {
  return {
    id: 'macro-legacy',
    groupTrainingPlanId: 'plan-1',
    title: 'Legacy macrocycle',
    startDate: '2026-09-01',
    endDate: '2026-11-15',
    targetRaceName: 'Legacy Race',
    targetRaceDate: '2026-11-15',
    targetRaceDistanceKm: 42,
    targetRaceElevationGain: 1800,
    ...overrides,
  }
}

function competition(
  overrides: Partial<CompetitionEntry> = {},
): CompetitionEntry {
  return {
    id: 'competition-a',
    groupTrainingPlanId: 'plan-1',
    name: 'Current Race',
    date: '2026-12-06',
    distanceKm: 50,
    elevationGainM: 2200,
    priority: 'A',
    status: 'confirmed',
    description: null,
    isDeleted: false,
    createdAt: '2026-09-11T12:00:00.000Z',
    updatedAt: '2026-09-11T12:00:00.000Z',
    ...overrides,
  }
}

test('adapts a complete legacy target-race snapshot as primary competition context', () => {
  const context = adaptLegacyTargetRaceSnapshot(macrocycle())

  assert.equal(context?.primaryCompetition?.id, 'legacy-macrocycle:macro-legacy')
  assert.equal(context?.primaryCompetition?.name, 'Legacy Race')
  assert.equal(context?.primaryCompetition?.date, '2026-11-15')
  assert.equal(context?.primaryCompetition?.distanceKm, 42)
  assert.equal(context?.primaryCompetition?.elevationGain, 1800)
  assert.equal(context?.primaryCompetition?.priority, 'A')
  assert.deepEqual(context?.intermediateCompetitions, [])
})

test('prefers CompetitionEntry calendar over a legacy snapshot', () => {
  const result = resolveCompetitionContext({
    competitionEntries: [competition()],
    legacyMacrocycleSnapshot: macrocycle(),
  })

  assert.equal(result.valid, true)
  if (!result.valid) return

  assert.equal(result.source, 'competition_calendar')
  assert.equal(result.context.primaryCompetition?.id, 'competition-a')
  assert.equal(result.context.primaryCompetition?.name, 'Current Race')
})

test('does not revive a legacy snapshot when a current calendar exists but is inactive', () => {
  const result = resolveCompetitionContext({
    competitionEntries: [competition({ status: 'cancelled' })],
    legacyMacrocycleSnapshot: macrocycle(),
  })

  assert.equal(result.valid, true)
  if (!result.valid) return

  assert.equal(result.source, 'competition_calendar')
  assert.equal(result.context.primaryCompetition, null)
  assert.deepEqual(result.context.intermediateCompetitions, [])
})

test('falls back to a complete legacy snapshot when no CompetitionEntry calendar exists', () => {
  const result = resolveCompetitionContext({
    competitionEntries: [],
    legacyMacrocycleSnapshot: macrocycle(),
  })

  assert.equal(result.valid, true)
  if (!result.valid) return

  assert.equal(result.source, 'legacy_snapshot')
  assert.equal(result.context.primaryCompetition?.name, 'Legacy Race')
})

test('keeps an incomplete legacy snapshot operational without inventing a race date', () => {
  const result = resolveCompetitionContext({
    competitionEntries: [],
    legacyMacrocycleSnapshot: macrocycle({ targetRaceDate: null }),
  })

  assert.equal(result.valid, true)
  if (!result.valid) return

  assert.equal(result.source, 'legacy_snapshot_incomplete')
  assert.equal(result.context.primaryCompetition, null)
  assert.deepEqual(result.context.intermediateCompetitions, [])
})

test('keeps a neutral plan neutral when neither calendar nor legacy snapshot exists', () => {
  const result = resolveCompetitionContext({
    competitionEntries: [],
    legacyMacrocycleSnapshot: macrocycle({
      targetRaceName: null,
      targetRaceDate: null,
      targetRaceDistanceKm: null,
      targetRaceElevationGain: null,
    }),
  })

  assert.equal(result.valid, true)
  if (!result.valid) return

  assert.equal(result.source, 'none')
  assert.equal(result.context.primaryCompetition, null)
})

test('preserves CompetitionContext validation errors from the live calendar', () => {
  const result = resolveCompetitionContext({
    competitionEntries: [
      competition({ id: 'a-1' }),
      competition({ id: 'a-2' }),
    ],
    legacyMacrocycleSnapshot: macrocycle(),
  })

  assert.equal(result.valid, false)
  if (result.valid) return

  assert.deepEqual(result.errors, ['competition_context_multiple_primary_candidates'])
})
