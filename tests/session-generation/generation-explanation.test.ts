import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  GENERATION_EXPLANATION_STAGE_ORDER,
  type GenerationExplanation,
} from '@/lib/session-generation/generation-explanation'

describe('GenerationExplanation contract', () => {
  it('freezes the causal stage order without embedding localized narrative', () => {
    assert.deepEqual(GENERATION_EXPLANATION_STAGE_ORDER, [
      'weekly_budget',
      'frequency',
      'slots',
      'stimulus_template',
      'fixed_load',
      'remaining_budget',
      'flexible_allocation',
      'intensity',
      'coordination_reconciliation',
    ])
  })

  it('represents planning-scope-aware structured evidence', () => {
    const explanation = {
      planningScope: {
        kind: 'variant',
        groupTrainingPlanId: 'plan-variant-s2',
        groupId: 'S2',
        planningCohortId: 'cohort-21k',
        microcycleId: 'micro-variant-s2-8',
      },
      stages: [{
        stage: 'weekly_budget',
        inputs: [{ code: 'target_volume_km', value: 40 }],
        constraints: [],
        decision: [{ code: 'weekly_budget_resolved', value: true }],
        consequence: [{ code: 'available_volume_km', value: 40 }],
        warnings: [],
      }],
    } satisfies GenerationExplanation

    assert.equal(explanation.planningScope.kind, 'variant')
    assert.equal(explanation.stages[0].inputs[0].code, 'target_volume_km')
    assert.equal(explanation.stages[0].inputs[0].value, 40)
  })

  it('keeps warnings structured and machine-readable', () => {
    const explanation = {
      planningScope: {
        kind: 'base',
        groupTrainingPlanId: 'plan-base-s2',
        groupId: 'S2',
        planningCohortId: null,
        microcycleId: 'micro-base-s2-8',
      },
      stages: [{
        stage: 'fixed_load',
        inputs: [{ code: 'fixed_volume_km', value: 44 }],
        constraints: [{ code: 'target_volume_km', value: 40 }],
        decision: [{ code: 'fixed_load_preserved', value: true }],
        consequence: [{ code: 'remaining_volume_km', value: -4 }],
        warnings: [{
          code: 'fixed_volume_exceeds_target',
          facts: [
            { code: 'target_volume_km', value: 40 },
            { code: 'fixed_volume_km', value: 44 },
          ],
        }],
      }],
    } satisfies GenerationExplanation

    assert.equal(explanation.stages[0].warnings[0].code, 'fixed_volume_exceeds_target')
    assert.deepEqual(
      explanation.stages[0].warnings[0].facts.map(({ value }) => value),
      [40, 44],
    )
  })
})
