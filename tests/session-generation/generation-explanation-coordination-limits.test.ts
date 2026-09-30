import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  explainPlanningScopeAndCoordination,
} from '@/lib/session-generation/generation-explanation'
import { groupSharedSessionEvents } from '@/lib/session-generation/shared-session-events'
import type {
  SessionGenerationProposal,
  SessionGenerationResult,
} from '@/types/training/session-generation.types'

describe('GenerationExplanation shared-event coordination limits', () => {
  it('does not bypass incompatible shared-event rejection', () => {
    const first = proposal({
      generationKey: 'plan-s2::micro-s2::S2::weekly-saturday',
      groupId: 'S2',
      microcycleId: 'micro-s2',
      title: 'Fondo compartido',
    })
    const incompatible = proposal({
      generationKey: 'plan-m1::micro-m1::M1::weekly-saturday',
      groupId: 'M1',
      microcycleId: 'micro-m1',
      title: 'Otro fondo',
    })

    assert.throws(
      () => groupSharedSessionEvents([generation(first, incompatible)]),
      /incompatible session values/,
    )
  })

  it('does not bypass duplicate planning-scope rejection', () => {
    const first = proposal({
      generationKey: 'plan-s2::micro-s2::S2::weekly-saturday',
      groupId: 'S2',
      microcycleId: 'micro-s2',
      title: 'Fondo compartido',
    })
    const duplicatedScope = proposal({
      generationKey: 'plan-other::micro-s2::M1::weekly-saturday',
      groupId: 'M1',
      microcycleId: 'micro-s2',
      title: 'Fondo compartido',
    })

    assert.throws(
      () => groupSharedSessionEvents([generation(first, duplicatedScope)]),
      /duplicate planning scope micro-s2/,
    )
  })

  it('reports absence from an already-valid shared result instead of inventing sibling coordination', () => {
    const current = proposal({
      generationKey: 'plan-s2::micro-s2::S2::weekly-saturday',
      groupId: 'S2',
      microcycleId: 'micro-s2',
      title: 'Fondo compartido',
    })
    const shared = groupSharedSessionEvents([generation(current)])

    const result = explainPlanningScopeAndCoordination({
      planningScope: {
        kind: 'base',
        groupTrainingPlanId: 'plan-missing',
        groupId: 'M1',
        planningCohortId: null,
        microcycleId: 'micro-missing',
      },
      sharedGeneration: shared,
      generationKey: 'plan-missing::micro-missing::M1::weekly-saturday',
    })

    assert.ok(result.coordination.decision.some((fact) => (
      fact.code === 'current_scope_participates' && fact.value === false
    )))
    assert.ok(result.coordination.warnings.some((warning) => (
      warning.code === 'current_generation_not_present_in_shared_result'
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'shared_prescription_count' && fact.value === 0
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'coexisting_microcycle_ids' && fact.value === ''
    )))
  })
})

function generation(...proposals: SessionGenerationProposal[]): SessionGenerationResult {
  return { proposals, warnings: [] }
}

function proposal(input: {
  generationKey: string
  groupId: string
  microcycleId: string
  title: string
}): SessionGenerationProposal {
  return {
    generationKey: input.generationKey,
    sharedEventKey: 'team-1::2026-09-12::long::template-long',
    slotKey: 'weekly-saturday',
    role: 'long',
    session: {
      date: '2026-09-12',
      title: input.title,
      type: 'Long',
      sourceTemplateId: 'template-long',
      locationKey: 'park',
      trackPath: null,
      structure: null,
      notes: null,
    },
    prescription: {
      groupId: input.groupId,
      microcycleId: input.microcycleId,
      distanceKm: 12,
      durationMin: null,
      elevationGain: 500,
      intensityMethod: 'hr_zone',
      zone: 'Z2',
      referencePercentage: null,
      notes: null,
    },
    warnings: [],
  }
}
