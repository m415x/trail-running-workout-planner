import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolveLegacyPlanningIntent } from '@/lib/periodization/planning-intent'

import type { PlanningIntent, TrainingGoalType } from '@/types'

const LEGACY_EXPECTATIONS: ReadonlyArray<readonly [TrainingGoalType, PlanningIntent]> = [
  ['race', 'development'],
  ['performance', 'development'],
  ['base', 'base'],
  ['maintenance', 'maintenance'],
  ['custom', 'development'],
]

describe('planning intent legacy adapter', () => {
  it('maps every legacy planning goal to the approved planning intent', () => {
    for (const [goalType, expectedIntent] of LEGACY_EXPECTATIONS) {
      assert.equal(resolveLegacyPlanningIntent(goalType), expectedIntent)
    }
  })

  it('does not encode race as a planning intent', () => {
    assert.equal(resolveLegacyPlanningIntent('race'), 'development')
  })
})
