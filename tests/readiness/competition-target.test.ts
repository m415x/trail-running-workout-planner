import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { AthleteIntegralPlanningResolution } from '@/lib/planning-cohorts/integral-planning-resolution'
import { resolveReadinessCompetitionTarget } from '@/lib/readiness/competition-target'
import type { CompetitionEntry, PlanningReviewScope } from '@/types'

const scope: PlanningReviewScope = {
  teamId: 'team-1',
  groupId: 'group-1',
  groupTrainingPlanId: 'variant-plan',
  kind: 'cohort_variant',
  planningCohortId: 'cohort-a',
  sourceGroupTrainingPlanId: 'base-plan',
}

function competition(id: string, priority: 'A' | 'B' | 'C', date: string): CompetitionEntry {
  return {
    id,
    groupTrainingPlanId: 'variant-plan',
    name: `Race ${id}`,
    date,
    distanceKm: priority === 'A' ? 42 : 21,
    elevationGainM: priority === 'A' ? 1800 : 600,
    priority,
    status: 'confirmed',
    isDeleted: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }
}

function resolved(entries: readonly CompetitionEntry[]): AthleteIntegralPlanningResolution {
  return {
    status: 'resolved',
    source: 'cohort',
    planId: 'variant-plan',
    review: {
      scope,
      competitions: entries.map((entry) => ({ entry, impactWindow: null })),
    },
  } as unknown as AthleteIntegralPlanningResolution
}

describe('readiness competition target resolution', () => {
  it('usa la A primaria del contexto de planificación aplicable al atleta', () => {
    const primary = competition('a', 'A', '2026-11-01')
    const intermediate = competition('b', 'B', '2026-10-10')

    const result = resolveReadinessCompetitionTarget({
      planningResolution: resolved([intermediate, primary]),
    })

    assert.equal(result.status, 'resolved')
    if (result.status !== 'resolved') return
    assert.equal(result.source, 'primary_competition')
    assert.equal(result.target.competitionEntryId, 'a')
    assert.equal(result.target.scope.groupTrainingPlanId, 'variant-plan')
  })

  it('permite selección explícita de una carrera intermedia aplicable', () => {
    const result = resolveReadinessCompetitionTarget({
      planningResolution: resolved([
        competition('b', 'B', '2026-10-10'),
        competition('a', 'A', '2026-11-01'),
      ]),
      selectedCompetitionEntryId: 'b',
    })

    assert.equal(result.status, 'resolved')
    if (result.status !== 'resolved') return
    assert.equal(result.source, 'explicit_selection')
    assert.equal(result.target.competitionEntryId, 'b')
  })

  it('no inventa inscripción a una carrera fuera del contexto resuelto', () => {
    const result = resolveReadinessCompetitionTarget({
      planningResolution: resolved([competition('a', 'A', '2026-11-01')]),
      selectedCompetitionEntryId: 'other-plan-race',
    })

    assert.deepEqual(result, {
      status: 'unavailable',
      reason: 'selected_competition_not_applicable',
    })
  })

  it('exige selección cuando sólo hay B/C y no existe primaria A', () => {
    const result = resolveReadinessCompetitionTarget({
      planningResolution: resolved([
        competition('b', 'B', '2026-10-10'),
        competition('c', 'C', '2026-10-20'),
      ]),
    })

    assert.equal(result.status, 'selection_required')
    if (result.status !== 'selection_required') return
    assert.deepEqual(result.applicableCompetitions.map(({ id }) => id), ['b', 'c'])
  })
})
