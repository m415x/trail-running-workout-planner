import { suggestIntensityStrategyLimits } from '@/lib/periodization/intensity-strategy-limits'

import type {
  AthleteGroupCode,
  IntensityMethod,
  IntensityStrategyDraft,
  IntensityStrategyFieldSources,
  TrainingGoalType,
} from '@/types'

/**
 * Default method is a planning preference, not a mandate for every session.
 * Recovery and aerobic prescriptions may still use zones, while a specific
 * quality session may override a zone-based strategy with a PAM percentage.
 */
export const DEFAULT_INTENSITY_METHOD_BY_GOAL: Record<TrainingGoalType, IntensityMethod> = {
  race: 'pam_percentage',
  performance: 'pam_percentage',
  base: 'hr_zone',
  maintenance: 'hr_zone',
  custom: 'hr_zone',
}

const SUGGESTED_FIELD_SOURCES: IntensityStrategyFieldSources = {
  defaultMethod: 'suggested',
  maximumIntenseSessionsPerWeek: 'suggested',
  minimumRecoveryDaysBetweenIntenseSessions: 'suggested',
}

/** Selects the suggested method for the group plan objective. */
export function suggestDefaultIntensityMethod(goalType: TrainingGoalType): IntensityMethod {
  return DEFAULT_INTENSITY_METHOD_BY_GOAL[goalType]
}

/**
 * Builds the initial intensity strategy without persisting or scheduling it.
 * All returned values remain editable by the coach in later tasks.
 */
export function suggestIntensityStrategy(
  athleteGroup: AthleteGroupCode,
  goalType: TrainingGoalType,
): IntensityStrategyDraft {
  return {
    context: { athleteGroup, goalType },
    values: {
      defaultMethod: suggestDefaultIntensityMethod(goalType),
      ...suggestIntensityStrategyLimits(athleteGroup, goalType),
    },
    fieldSources: { ...SUGGESTED_FIELD_SOURCES },
  }
}
