import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import {
  GENERATION_EXPLANATION_STAGE_ORDER,
  type GenerationExplanationPlanningScope,
} from '@/lib/session-generation/generation-explanation'

describe('GenerationExplanation contract invariants', () => {
  it('contains every approved causal stage exactly once', () => {
    assert.equal(GENERATION_EXPLANATION_STAGE_ORDER.length, 9)
    assert.equal(new Set(GENERATION_EXPLANATION_STAGE_ORDER).size, 9)
  })

  it('requires Variant provenance to carry planning subgroup identity', () => {
    const scope: GenerationExplanationPlanningScope = {
      kind: 'variant',
      groupTrainingPlanId: 'plan-variant-s2',
      groupId: 'S2',
      planningCohortId: 'cohort-21k',
      microcycleId: 'micro-variant-s2-8',
    }

    assert.equal(scope.kind, 'variant')
    assert.equal(scope.planningCohortId, 'cohort-21k')
  })

  it('does not expose groupId as the generation explanation identity', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'lib/session-generation/generation-explanation.ts'),
      'utf8',
    )

    assert.match(source, /groupTrainingPlanId/)
    assert.match(source, /microcycleId/)
    assert.match(source, /planningCohortId/)
    assert.doesNotMatch(source, /scopeId:\s*string/)
  })
})
