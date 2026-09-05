import type { MicrocycleIntensityTargetDraft } from '@/types'

export interface ValidateIntensityFeasibilityParams {
  target: MicrocycleIntensityTargetDraft
  sessionsPerWeek: number
}

export interface IntensityFeasibilityValidationResult {
  isValid: boolean
  maximumFeasibleIntenseSessions: number
  errors: string[]
}

function getCalendarCapacity(minimumRecoveryDays: number): number {
  return Math.floor((7 + minimumRecoveryDays) / (minimumRecoveryDays + 1))
}

/**
 * Checks whether a weekly intensity target can fit in the available sessions.
 *
 * The calculation assumes a seven-day microcycle and interprets recovery as
 * complete calendar days between intense stimuli. It reports conflicts rather
 * than silently lowering a target chosen by the coach.
 */
export function validateIntensityFeasibility({
  target,
  sessionsPerWeek,
}: ValidateIntensityFeasibilityParams): IntensityFeasibilityValidationResult {
  const errors: string[] = []

  if (!Number.isInteger(sessionsPerWeek) || sessionsPerWeek < 1 || sessionsPerWeek > 7) {
    return {
      isValid: false,
      maximumFeasibleIntenseSessions: 0,
      errors: ['Las sesiones semanales disponibles deben ser un entero entre 1 y 7.'],
    }
  }

  if (!Number.isInteger(target.intenseSessionsTarget) || target.intenseSessionsTarget < 0) {
    return {
      isValid: false,
      maximumFeasibleIntenseSessions: 0,
      errors: ['El objetivo de sesiones intensas debe ser un entero mayor o igual que cero.'],
    }
  }

  if (
    !Number.isInteger(target.minimumRecoveryDaysBetweenIntenseSessions)
    || target.minimumRecoveryDaysBetweenIntenseSessions < 1
    || target.minimumRecoveryDaysBetweenIntenseSessions > 6
  ) {
    return {
      isValid: false,
      maximumFeasibleIntenseSessions: 0,
      errors: ['La recuperación mínima debe ser un entero entre 1 y 6 días completos.'],
    }
  }

  const calendarCapacity = getCalendarCapacity(
    target.minimumRecoveryDaysBetweenIntenseSessions,
  )
  const maximumFeasibleIntenseSessions = Math.min(sessionsPerWeek, calendarCapacity)

  if (target.intenseSessionsTarget > sessionsPerWeek) {
    errors.push(
      `El objetivo de ${target.intenseSessionsTarget} sesiones intensas supera las ${sessionsPerWeek} sesiones disponibles.`,
    )
  }

  if (target.intenseSessionsTarget > calendarCapacity) {
    errors.push(
      `No es posible separar ${target.intenseSessionsTarget} sesiones intensas por ${target.minimumRecoveryDaysBetweenIntenseSessions} días completos dentro de una semana.`,
    )
  }

  return {
    isValid: errors.length === 0,
    maximumFeasibleIntenseSessions,
    errors,
  }
}
