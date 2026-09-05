import type {
  AthleteGroupCode,
  AthleteLevelCode,
  IntensityStrategyLimits,
  TrainingGoalType,
} from '@/types'

export const INTENSITY_LIMIT_CONSTRAINTS = {
  maximumIntenseSessionsPerWeek: { min: 0, max: 3 },
  minimumRecoveryDaysBetweenIntenseSessions: { min: 1, max: 6 },
} as const

const MAXIMUM_INTENSE_SESSIONS_BY_LEVEL: Record<AthleteLevelCode, number> = {
  '1': 3,
  '2': 2,
  '3': 1,
}

const MAXIMUM_INTENSE_SESSIONS_BY_GOAL: Record<TrainingGoalType, number> = {
  race: 2,
  performance: 2,
  base: 1,
  maintenance: 1,
  custom: 2,
}

const MINIMUM_RECOVERY_DAYS_BY_LEVEL: Record<AthleteLevelCode, number> = {
  '1': 1,
  '2': 1,
  '3': 2,
}

export interface IntensityLimitsValidationResult {
  isValid: boolean
  errors: string[]
}

/**
 * Suggests conservative weekly limits from the group level and objective.
 *
 * One recovery day means one complete calendar day between intense sessions;
 * for example, Tuesday and Thursday have Wednesday as their recovery day.
 */
export function suggestIntensityStrategyLimits(
  athleteGroup: AthleteGroupCode,
  goalType: TrainingGoalType,
): IntensityStrategyLimits {
  const levelCode = athleteGroup[1] as AthleteLevelCode

  return {
    maximumIntenseSessionsPerWeek: Math.min(
      MAXIMUM_INTENSE_SESSIONS_BY_LEVEL[levelCode],
      MAXIMUM_INTENSE_SESSIONS_BY_GOAL[goalType],
    ),
    minimumRecoveryDaysBetweenIntenseSessions: MINIMUM_RECOVERY_DAYS_BY_LEVEL[levelCode],
  }
}

/** Validates absolute limits before strategy or weekly calculations use them. */
export function validateIntensityStrategyLimits(
  limits: IntensityStrategyLimits,
): IntensityLimitsValidationResult {
  const errors: string[] = []
  const sessionConstraint = INTENSITY_LIMIT_CONSTRAINTS.maximumIntenseSessionsPerWeek
  const recoveryConstraint = INTENSITY_LIMIT_CONSTRAINTS.minimumRecoveryDaysBetweenIntenseSessions

  if (
    !Number.isInteger(limits.maximumIntenseSessionsPerWeek)
    || limits.maximumIntenseSessionsPerWeek < sessionConstraint.min
    || limits.maximumIntenseSessionsPerWeek > sessionConstraint.max
  ) {
    errors.push(
      `Las sesiones intensas máximas deben ser un entero entre ${sessionConstraint.min} y ${sessionConstraint.max}.`,
    )
  }

  if (
    !Number.isInteger(limits.minimumRecoveryDaysBetweenIntenseSessions)
    || limits.minimumRecoveryDaysBetweenIntenseSessions < recoveryConstraint.min
    || limits.minimumRecoveryDaysBetweenIntenseSessions > recoveryConstraint.max
  ) {
    errors.push(
      `La recuperación mínima debe ser un entero entre ${recoveryConstraint.min} y ${recoveryConstraint.max} días completos.`,
    )
  }

  return { isValid: errors.length === 0, errors }
}
