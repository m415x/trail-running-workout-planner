import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  parseGenerationExplanationSnapshots,
  resolveGenerationExplanationSnapshot,
} from '@/lib/session-generation/generation-explanation-persistence'
import type { GenerationExplanation } from '@/lib/session-generation/generation-explanation'

describe('GenerationExplanation historical snapshot transport', () => {
  it('parses a separate generationKey-indexed snapshot map', () => {
    const explanation = validExplanation({
      kind: 'variant',
      groupTrainingPlanId: 'plan-variant',
      groupId: 'group-1',
      planningCohortId: 'cohort-1',
      microcycleId: 'micro-1',
    })

    const parsed = parseGenerationExplanationSnapshots(JSON.stringify({
      'plan-variant::micro-1::group-1::weekly-tuesday': explanation,
    }))

    assert.deepEqual(
      parsed.get('plan-variant::micro-1::group-1::weekly-tuesday'),
      explanation,
    )
  })

  it('rejects malformed snapshots instead of treating them as planning input', () => {
    assert.throws(
      () => parseGenerationExplanationSnapshots(JSON.stringify({
        'generation-key': {
          planningScope: {
            kind: 'base',
            groupTrainingPlanId: 'plan-1',
            groupId: 'group-1',
            planningCohortId: null,
            microcycleId: 'micro-1',
          },
          stages: [],
        },
      })),
      /causal stage order/,
    )
  })

  it('resolves a snapshot only when generation identity and planning scope match', () => {
    const key = 'plan-1::micro-1::group-1::weekly-tuesday'
    const snapshots = new Map<string, GenerationExplanation>([
      [key, validExplanation({
        kind: 'base',
        groupTrainingPlanId: 'plan-1',
        groupId: 'group-1',
        planningCohortId: null,
        microcycleId: 'micro-1',
      })],
    ])

    const resolved = resolveGenerationExplanationSnapshot({
      snapshots,
      generationKey: key,
      expectedScope: {
        kind: 'base',
        groupTrainingPlanId: 'plan-1',
        groupId: 'group-1',
        planningCohortId: null,
        microcycleId: 'micro-1',
      },
    })

    assert.deepEqual(resolved, snapshots.get(key))
  })

  it('rejects cross-plan, cross-microcycle or Base/Variant scope drift', () => {
    const key = 'plan-variant::micro-1::group-1::weekly-tuesday'
    const snapshots = new Map<string, GenerationExplanation>([
      [key, validExplanation({
        kind: 'variant',
        groupTrainingPlanId: 'plan-variant',
        groupId: 'group-1',
        planningCohortId: 'cohort-1',
        microcycleId: 'micro-1',
      })],
    ])

    assert.throws(
      () => resolveGenerationExplanationSnapshot({
        snapshots,
        generationKey: key,
        expectedScope: {
          kind: 'variant',
          groupTrainingPlanId: 'plan-variant',
          groupId: 'group-1',
          planningCohortId: 'cohort-other',
          microcycleId: 'micro-1',
        },
      }),
      /planning scope/,
    )
  })

  it('returns null when no historical snapshot was supplied for a valid proposal', () => {
    assert.equal(
      resolveGenerationExplanationSnapshot({
        snapshots: new Map(),
        generationKey: 'plan-1::micro-1::group-1::weekly-tuesday',
        expectedScope: {
          kind: 'base',
          groupTrainingPlanId: 'plan-1',
          groupId: 'group-1',
          planningCohortId: null,
          microcycleId: 'micro-1',
        },
      }),
      null,
    )
  })
})

function validExplanation(
  planningScope: GenerationExplanation['planningScope'],
): GenerationExplanation {
  const stages = [
    'weekly_budget',
    'frequency',
    'slots',
    'stimulus_template',
    'fixed_load',
    'remaining_budget',
    'flexible_allocation',
    'intensity',
    'coordination_reconciliation',
  ] as const

  return {
    planningScope,
    stages: stages.map((stage) => ({
      stage,
      inputs: [],
      constraints: [],
      decision: [],
      consequence: [],
      warnings: [],
    })),
  }
}
