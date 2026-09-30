import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  assertValidGenerationExplanation,
  type GenerationExplanation,
} from '@/lib/session-generation/generation-explanation'

const stage = (name: GenerationExplanation['stages'][number]['stage']) => ({
  stage: name,
  inputs: [],
  constraints: [],
  decision: [],
  consequence: [],
  warnings: [],
})

const completeStages = () => [
  stage('weekly_budget'),
  stage('frequency'),
  stage('slots'),
  stage('stimulus_template'),
  stage('fixed_load'),
  stage('remaining_budget'),
  stage('flexible_allocation'),
  stage('intensity'),
  stage('coordination_reconciliation'),
]

describe('GenerationExplanation runtime contract', () => {
  it('accepts the complete approved causal sequence', () => {
    assert.doesNotThrow(() => assertValidGenerationExplanation({
      planningScope: {
        kind: 'base',
        groupTrainingPlanId: 'plan-base-s2',
        groupId: 'S2',
        planningCohortId: null,
        microcycleId: 'micro-base-s2-8',
      },
      stages: completeStages(),
    }))
  })

  it('rejects missing or reordered stages', () => {
    const base: GenerationExplanation = {
      planningScope: {
        kind: 'base',
        groupTrainingPlanId: 'plan-base-s2',
        groupId: 'S2',
        planningCohortId: null,
        microcycleId: 'micro-base-s2-8',
      },
      stages: [
        stage('weekly_budget'),
        stage('slots'),
        stage('frequency'),
        stage('stimulus_template'),
        stage('fixed_load'),
        stage('remaining_budget'),
        stage('flexible_allocation'),
        stage('intensity'),
        stage('coordination_reconciliation'),
      ],
    }

    assert.throws(() => assertValidGenerationExplanation(base), /causal stage order/i)
    assert.throws(
      () => assertValidGenerationExplanation({ ...base, stages: base.stages.slice(0, -1) }),
      /causal stage order/i,
    )
  })

  it('rejects incoherent Base and Variant scope evidence', () => {
    assert.throws(() => assertValidGenerationExplanation({
      planningScope: {
        kind: 'base',
        groupTrainingPlanId: 'plan-base-s2',
        groupId: 'S2',
        planningCohortId: 'cohort-should-not-exist',
        microcycleId: 'micro-base-s2-8',
      } as unknown as GenerationExplanation['planningScope'],
      stages: completeStages(),
    }), /base.*planning subgroup/i)

    assert.throws(() => assertValidGenerationExplanation({
      planningScope: {
        kind: 'variant',
        groupTrainingPlanId: 'plan-variant-s2',
        groupId: 'S2',
        planningCohortId: '',
        microcycleId: 'micro-variant-s2-8',
      },
      stages: completeStages(),
    }), /variant.*planning subgroup/i)
  })
})
