import { suggestIntensityStrategyLimitsForPlanningIntent } from '@/lib/periodization/intensity-strategy-limits'
import { resolveLegacyPlanningIntent } from '@/lib/periodization/planning-intent'

import type {
  AthleteGroupCode,
  IntensityMethod,
  IntensityStrategyDraft,
  IntensityStrategyFieldSources,
  PlanningIntent,
  TrainingGoalType,
} from '@/types'

/**
 * Default intensity method belongs to planning intent, not competition context.
 * A concrete race may alter periodization without changing this base strategy.
 */
export const DEFAULT_INTENSITY_METHOD_BY_INTENT: Record<PlanningIntent, IntensityMethod> = {
  development: 'pam_percentage',
  base: 'hr_zone',
  maintenance: 'hr_zone',
}

const SUGGESTED_FIELD_SOURCES: IntensityStrategyFieldSources = {
  defaultMethod: 'suggested',
  maximumIntenseSessionsPerWeek: 'suggested',
  minimumRecoveryDaysBetweenIntenseSessions: 'suggested',
}

/** Selects the suggested method from the group plan's explicit intent. */
export function suggestDefaultIntensityMethodForPlanningIntent(
  planningIntent: PlanningIntent,
): IntensityMethod {
  return DEFAULT_INTENSITY_METHOD_BY_INTENT[planningIntent]
}

/** Primary H9 intensity recommender for group planning. */
export function suggestIntensityStrategyForPlanningIntent(
  athleteGroup: AthleteGroupCode,
  planningIntent: PlanningIntent,
  legacyGoalType: TrainingGoalType,
): IntensityStrategyDraft {
  return {
    context: {
      athleteGroup,
      // Transitional persistence metadata; it does not select the strategy.
      goalType: legacyGoalType,
    },
    values: {
      defaultMethod: suggestDefaultIntensityMethodForPlanningIntent(planningIntent),
      ...suggestIntensityStrategyLimitsForPlanningIntent(athleteGroup, planningIntent),
    },
    fieldSources: { ...SUGGESTED_FIELD_SOURCES },
  }
}

/** Legacy compatibility wrapper; `race` resolves to development. */
export function suggestDefaultIntensityMethod(goalType: TrainingGoalType): IntensityMethod {
  return suggestDefaultIntensityMethodForPlanningIntent(resolveLegacyPlanningIntent(goalType))
}

/**
 * Legacy compatibility wrapper for persisted strategies and old tests.
 * Competition semantics are not inferred from the legacy goal label.
 */
export function suggestIntensityStrategy(
  athleteGroup: AthleteGroupCode,
  goalType: TrainingGoalType,
): IntensityStrategyDraft {
  return suggestIntensityStrategyForPlanningIntent(
    athleteGroup,
    resolveLegacyPlanningIntent(goalType),
    goalType,
  )
}
