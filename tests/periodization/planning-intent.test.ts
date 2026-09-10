import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  resolveBasePlanLegacyGoalType,
  resolveLegacyPlanningIntent,
} from '@/lib/periodization/planning-intent'

import type { PlanningIntent, TrainingGoalType } from '@/types'

const LEGACY_EXPECTATIONS: ReadonlyArray<readonly [TrainingGoalType, PlanningIntent]> = [
  ['race', 'development'],
  ['performance', 'development'],
  ['base', 'base'],
  ['maintenance', 'maintenance'],
  ['custom', 'development'],
]

const BASE_PLAN_EXPECTATIONS: ReadonlyArray<readonly [PlanningIntent, TrainingGoalType]> = [
  ['development', 'performance'],
  ['base', 'base'],
  ['maintenance', 'maintenance'],
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

  it('maps every base planning intent to competition-neutral legacy metadata', () => {
    for (const [planningIntent, expectedGoalType] of BASE_PLAN_EXPECTATIONS) {
      assert.equal(resolveBasePlanLegacyGoalType(planningIntent), expectedGoalType)
    }
  })

  it('never persists race as the legacy backing value of a new base plan', () => {
    for (const planningIntent of ['development', 'base', 'maintenance'] as const) {
      assert.notEqual(resolveBasePlanLegacyGoalType(planningIntent), 'race')
    }
  })
})
