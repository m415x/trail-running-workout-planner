import type { TrainingGoalType } from '@/types/athlete/athlete.types'
import type { PlanningIntent } from '@/types/training/planning-intent.types'

const LEGACY_GOAL_TO_PLANNING_INTENT = {
  race: 'development',
  performance: 'development',
  base: 'base',
  maintenance: 'maintenance',
  custom: 'development',
} as const satisfies Record<TrainingGoalType, PlanningIntent>

const BASE_PLAN_INTENT_TO_LEGACY_GOAL = {
  development: 'performance',
  base: 'base',
  maintenance: 'maintenance',
} as const satisfies Record<PlanningIntent, TrainingGoalType>

/**
 * Maps legacy group-planning goal types to the dedicated planning intent model.
 *
 * This adapter exists only for H9 transition compatibility. A legacy race goal
 * maps to `development`; its concrete race data must be carried separately as
 * competition context by later migration steps.
 */
export function resolveLegacyPlanningIntent(goalType: TrainingGoalType): PlanningIntent {
  return LEGACY_GOAL_TO_PLANNING_INTENT[goalType]
}

/**
 * Provides the temporary legacy persistence/recommender value for a base plan.
 *
 * `development` intentionally maps to `performance`, never `race`, so creating a
 * base plan cannot acquire competitive semantics while legacy schemas still
 * require `TrainingGoalType`.
 */
export function resolveBasePlanLegacyGoalType(planningIntent: PlanningIntent): TrainingGoalType {
  return BASE_PLAN_INTENT_TO_LEGACY_GOAL[planningIntent]
}
