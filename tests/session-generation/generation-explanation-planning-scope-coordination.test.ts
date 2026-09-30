import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  explainPlanningScopeAndCoordination,
  type GenerationExplanationPlanningScope,
} from '@/lib/session-generation/generation-explanation'
import { groupSharedSessionEvents } from '@/lib/session-generation/shared-session-events'
import type {
  SessionGenerationProposal,
  SessionGenerationResult,
} from '@/types/training/session-generation.types'

describe('GenerationExplanation planning scope and shared-event coordination', () => {
  it('keeps the current Variant scope explicit while describing real shared-event convergence', () => {
    const base = proposal({
      generationKey: 'plan-base-s2::micro-base-s2::S2::weekly-saturday',
      groupId: 'S2',
      microcycleId: 'micro-base-s2',
      distanceKm: 12,
    })
    const variant = proposal({
      generationKey: 'plan-variant-s2::micro-variant-s2::S2::weekly-saturday',
      groupId: 'S2',
      microcycleId: 'micro-variant-s2',
      distanceKm: 9,
    })
    const otherGroup = proposal({
      generationKey: 'plan-m1::micro-m1::M1::weekly-saturday',
      groupId: 'M1',
      microcycleId: 'micro-m1',
      distanceKm: 16,
    })
    const shared = groupSharedSessionEvents([
      generation(base),
      generation(variant),
      generation(otherGroup),
    ])
    const planningScope: GenerationExplanationPlanningScope = {
      kind: 'variant',
      groupTrainingPlanId: 'plan-variant-s2',
      groupId: 'S2',
      planningCohortId: 'cohort-variant-s2',
      microcycleId: 'micro-variant-s2',
    }

    const result = explainPlanningScopeAndCoordination({
      planningScope,
      sharedGeneration: shared,
      generationKey: variant.generationKey,
    })

    assert.deepEqual(result.planningScope, planningScope)
    assert.equal(result.coordination.stage, 'coordination_reconciliation')
    assert.ok(result.coordination.inputs.some((fact) => (
      fact.code === 'shared_event_key' &&
      fact.value === 'team-1::2026-09-12::long::template-long'
    )))
    assert.ok(result.coordination.inputs.some((fact) => (
      fact.code === 'current_generation_key' &&
      fact.value === variant.generationKey
    )))
    assert.ok(result.coordination.decision.some((fact) => (
      fact.code === 'current_scope_participates' && fact.value === true
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'shared_prescription_count' && fact.value === 3
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'coexisting_microcycle_ids' &&
      fact.value === 'micro-base-s2,micro-m1,micro-variant-s2'
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'coordination_source' &&
      fact.value === 'shared_generation_result'
    )))
  })

  it('does not infer sibling Base/Variant or planning-cohort metadata that the shared result does not carry', () => {
    const current = proposal({
      generationKey: 'plan-base-s2::micro-base-s2::S2::weekly-saturday',
      groupId: 'S2',
      microcycleId: 'micro-base-s2',
      distanceKm: 12,
    })
    const sibling = proposal({
      generationKey: 'plan-variant-s2::micro-variant-s2::S2::weekly-saturday',
      groupId: 'S2',
      microcycleId: 'micro-variant-s2',
      distanceKm: 9,
    })
    const shared = groupSharedSessionEvents([generation(current), generation(sibling)])

    const result = explainPlanningScopeAndCoordination({
      planningScope: {
        kind: 'base',
        groupTrainingPlanId: 'plan-base-s2',
        groupId: 'S2',
        planningCohortId: null,
        microcycleId: 'micro-base-s2',
      },
      sharedGeneration: shared,
      generationKey: current.generationKey,
    })

    const allFacts = [
      ...result.coordination.inputs,
      ...result.coordination.constraints,
      ...result.coordination.decision,
      ...result.coordination.consequence,
    ]

    assert.equal(allFacts.some((fact) => fact.code === 'sibling_scope_kind'), false)
    assert.equal(allFacts.some((fact) => fact.code === 'sibling_planning_cohort_id'), false)
  })

  it('explains only convergence already present in the supplied result and never requires sibling generation inputs', () => {
    const current = proposal({
      generationKey: 'plan-base-s2::micro-base-s2::S2::weekly-saturday',
      groupId: 'S2',
      microcycleId: 'micro-base-s2',
      distanceKm: 12,
    })
    const shared = groupSharedSessionEvents([generation(current)])

    const result = explainPlanningScopeAndCoordination({
      planningScope: {
        kind: 'base',
        groupTrainingPlanId: 'plan-base-s2',
        groupId: 'S2',
        planningCohortId: null,
        microcycleId: 'micro-base-s2',
      },
      sharedGeneration: shared,
      generationKey: current.generationKey,
    })

    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'shared_prescription_count' && fact.value === 1
    )))
    assert.ok(result.coordination.consequence.some((fact) => (
      fact.code === 'coordination_source' &&
      fact.value === 'shared_generation_result'
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
  distanceKm: number
}): SessionGenerationProposal {
  return {
    generationKey: input.generationKey,
    sharedEventKey: 'team-1::2026-09-12::long::template-long',
    slotKey: 'weekly-saturday',
    role: 'long',
    session: {
      date: '2026-09-12',
      title: 'Fondo compartido',
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
      distanceKm: input.distanceKm,
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
