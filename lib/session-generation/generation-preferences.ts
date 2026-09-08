import {
  createWeeklyTrainingSlot,
  DEFAULT_WEEKLY_TRAINING_PATTERN,
} from '@/lib/session-generation/default-weekly-pattern'
import type {
  TrainingWeekday,
  WeeklySessionFrequency,
  WeeklySessionRole,
  WeeklyTrainingPattern,
} from '@/types/training/session-generation.types'

const WEEKDAYS: TrainingWeekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const ROLES: WeeklySessionRole[] = [
  'base',
  'mountain',
  'long',
  'quality',
  'recovery',
  'competition',
]

export interface WeeklyGenerationPreferences {
  frequency: WeeklySessionFrequency
  pattern: WeeklyTrainingPattern
}

/**
 * UI semantics for the optional fixed-session input:
 * empty => AUTO; 3-5 => FIXED. No null/zero sentinel leaks into the domain.
 */
export function parseWeeklySessionFrequency(value: string): WeeklySessionFrequency {
  const normalized = value.trim()
  if (normalized === '') return { mode: 'auto' }

  const sessionsPerWeek = Number(normalized)
  if (!Number.isInteger(sessionsPerWeek) || sessionsPerWeek < 3 || sessionsPerWeek > 5) {
    throw new RangeError('La frecuencia fija debe ser un número entero entre 3 y 5')
  }

  return { mode: 'fixed', sessionsPerWeek }
}

/**
 * Builds a domain pattern from configurable weekday/role pairs. Days are unique
 * and role preferences are derived centrally instead of being persisted twice.
 */
export function buildWeeklyTrainingPattern(
  slots: Array<{ weekday: string; role: string }>,
): WeeklyTrainingPattern {
  if (slots.length < 3 || slots.length > 7) {
    throw new RangeError('El patrón semanal debe tener entre 3 y 7 días habituales')
  }

  const weekdays = new Set<TrainingWeekday>()
  const pattern = slots.map(({ weekday, role }) => {
    if (!WEEKDAYS.includes(weekday as TrainingWeekday)) {
      throw new RangeError(`Día semanal inválido: ${weekday}`)
    }
    if (!ROLES.includes(role as WeeklySessionRole)) {
      throw new RangeError(`Rol semanal inválido: ${role}`)
    }

    const typedWeekday = weekday as TrainingWeekday
    if (weekdays.has(typedWeekday)) {
      throw new RangeError(`El día ${typedWeekday} está repetido en el patrón semanal`)
    }
    weekdays.add(typedWeekday)

    return createWeeklyTrainingSlot(typedWeekday, role as WeeklySessionRole)
  })

  return { slots: pattern }
}

export function defaultWeeklyGenerationPreferences(): WeeklyGenerationPreferences {
  return {
    frequency: { mode: 'auto' },
    pattern: {
      slots: DEFAULT_WEEKLY_TRAINING_PATTERN.slots.map((slot) => ({
        ...slot,
        preferredWorkoutTypes: [...slot.preferredWorkoutTypes],
        preferredTemplateCategories: slot.preferredTemplateCategories
          ? [...slot.preferredTemplateCategories]
          : undefined,
      })),
    },
  }
}
