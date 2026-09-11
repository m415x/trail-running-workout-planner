import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  derivePlanningCohortVariant,
  PlanningVariantDerivationError,
  type PlanningVariantSource,
} from '@/lib/planning-cohorts/plan-derivation'
import type { CompetitionEntry, PlanningCohort } from '@/types'

const cohort: PlanningCohort = {
  id: 'cohort-1',
  teamId: 'team-1',
  groupId: 'group-m1',
  name: 'Cohorte Patagonia',
  purpose: 'Compartir adaptación competitiva.',
  description: null,
  status: 'active',
}

function sourceWithCompetitions(): PlanningVariantSource {
  const competitionEntries: CompetitionEntry[] = [
    {
      id: 'competition-a',
      groupTrainingPlanId: 'plan-base',
      name: 'Trail A',
      date: '2027-04-10',
      distanceKm: 42,
      elevationGainM: 2200,
      priority: 'A',
      status: 'confirmed',
      description: 'Objetivo principal.',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    },
    {
      id: 'competition-b',
      groupTrainingPlanId: 'plan-base',
      name: 'Trail B',
      date: '2027-03-01',
      distanceKm: 21,
      elevationGainM: 900,
      priority: 'B',
      status: 'planned',
      description: null,
    },
    {
      id: 'competition-c',
      groupTrainingPlanId: 'plan-base',
      name: 'Trail C',
      date: '2027-02-01',
      distanceKm: 12,
      elevationGainM: 450,
      priority: 'C',
      status: 'planned',
      description: null,
    },
  ]

  return {
    plan: {
      id: 'plan-base',
      groupId: 'group-m1',
      planningCohortId: null,
      sourceGroupTrainingPlanId: null,
      title: 'Plan base M1',
      status: 'active',
      notes: null,
    },
    loadStrategy: null,
    intensityStrategy: null,
    sessionGenerationPreferences: null,
    microcycleIntensityTargets: [],
    competitionEntries,
  }
}

function ids() {
  let index = 0
  return () => `derived-${++index}`
}

describe('competition calendar cohort derivation', () => {
  it('does not copy source competitions unless they are explicitly selected', () => {
    const result = derivePlanningCohortVariant({
      source: sourceWithCompetitions(),
      cohort,
      title: 'Variante Patagonia',
      createId: ids(),
    })

    assert.deepEqual(result.competitionEntries, [])
    assert.deepEqual(result.identityMap.competitionEntryIds, {})
  })

  it('copies only selected competitions with new identities and variant ownership', () => {
    const source = sourceWithCompetitions()
    const result = derivePlanningCohortVariant({
      source,
      cohort,
      title: 'Variante Patagonia',
      selectedCompetitionEntryIds: ['competition-b'],
      createId: ids(),
    })

    assert.equal(result.competitionEntries.length, 1)
    assert.deepEqual(result.competitionEntries[0], {
      id: 'derived-2',
      groupTrainingPlanId: 'derived-1',
      name: 'Trail B',
      date: '2027-03-01',
      distanceKm: 21,
      elevationGainM: 900,
      priority: 'B',
      status: 'planned',
      description: null,
    })
    assert.equal(result.identityMap.competitionEntryIds['competition-b'], 'derived-2')
    assert.equal(result.identityMap.competitionEntryIds['competition-a'], undefined)
  })

  it('preserves A B C priorities when a cohort variant explicitly selects the full calendar', () => {
    const result = derivePlanningCohortVariant({
      source: sourceWithCompetitions(),
      cohort,
      title: 'Variante Patagonia',
      selectedCompetitionEntryIds: ['competition-a', 'competition-b', 'competition-c'],
      createId: ids(),
    })

    assert.deepEqual(
      result.competitionEntries.map((entry) => entry.priority),
      ['A', 'B', 'C'],
    )
    assert.equal(result.competitionEntries.every((entry) => (
      entry.groupTrainingPlanId === result.plan.id
    )), true)
    assert.equal(result.plan.sourceGroupTrainingPlanId, 'plan-base')
  })

  it('creates an independent snapshot with no live synchronization to the source entry', () => {
    const source = sourceWithCompetitions()
    const result = derivePlanningCohortVariant({
      source,
      cohort,
      title: 'Variante Patagonia',
      selectedCompetitionEntryIds: ['competition-a'],
      createId: ids(),
    })

    source.competitionEntries![0].name = 'Nombre cambiado en base'
    source.competitionEntries![0].distanceKm = 55

    assert.equal(result.competitionEntries[0].name, 'Trail A')
    assert.equal(result.competitionEntries[0].distanceKm, 42)
  })

  it('rejects duplicate, unknown and foreign-owned competition selections', () => {
    const duplicate = () => derivePlanningCohortVariant({
      source: sourceWithCompetitions(),
      cohort,
      title: 'Variante',
      selectedCompetitionEntryIds: ['competition-a', 'competition-a'],
      createId: ids(),
    })

    assert.throws(duplicate, (error: unknown) => (
      error instanceof PlanningVariantDerivationError &&
      error.issues.some((issue) => issue.code === 'duplicate-competition-selection')
    ))

    const unknown = () => derivePlanningCohortVariant({
      source: sourceWithCompetitions(),
      cohort,
      title: 'Variante',
      selectedCompetitionEntryIds: ['competition-x'],
      createId: ids(),
    })

    assert.throws(unknown, (error: unknown) => (
      error instanceof PlanningVariantDerivationError &&
      error.issues.some((issue) => issue.code === 'competition-selection-not-in-source')
    ))

    const source = sourceWithCompetitions()
    source.competitionEntries![0].groupTrainingPlanId = 'other-plan'

    const foreignOwned = () => derivePlanningCohortVariant({
      source,
      cohort,
      title: 'Variante',
      selectedCompetitionEntryIds: ['competition-a'],
      createId: ids(),
    })

    assert.throws(foreignOwned, (error: unknown) => (
      error instanceof PlanningVariantDerivationError &&
      error.issues.some((issue) => issue.code === 'competition-selection-owner-mismatch')
    ))
  })
})
