import type {
  PersistedWeeklyTrainingPatternSlot,
  SessionFrequencyMode,
} from '@/db/session-generation-preferences-schema'
import {
  buildWeeklyTrainingPattern,
  defaultWeeklyGenerationPreferences,
} from '@/lib/session-generation/generation-preferences'
import type {
  WeeklySessionFrequency,
  WeeklyTrainingPattern,
} from '@/types/training/session-generation.types'

export interface StoredSessionGenerationPreferences {
  frequencyMode: SessionFrequencyMode
  fixedSessionsPerWeek: number | null
  weeklyPattern: PersistedWeeklyTrainingPatternSlot[]
}

export interface ResolvedSessionGenerationPreferences {
  frequency: WeeklySessionFrequency
  pattern: WeeklyTrainingPattern
}

export function serializeSessionGenerationPreferences(
  preferences: ResolvedSessionGenerationPreferences,
): StoredSessionGenerationPreferences {
  return {
    frequencyMode: preferences.frequency.mode,
    fixedSessionsPerWeek:
      preferences.frequency.mode === 'fixed'
        ? preferences.frequency.sessionsPerWeek
        : null,
    weeklyPattern: preferences.pattern.slots.map(({ weekday, role }) => ({
      weekday,
      role,
    })),
  }
}

export function resolveSessionGenerationPreferences(
  stored: StoredSessionGenerationPreferences | null | undefined,
): ResolvedSessionGenerationPreferences {
  if (!stored) return defaultWeeklyGenerationPreferences()

  const frequency = resolveFrequency(stored)
  const pattern = buildWeeklyTrainingPattern(stored.weeklyPattern)

  return { frequency, pattern }
}

function resolveFrequency(
  stored: StoredSessionGenerationPreferences,
): WeeklySessionFrequency {
  if (stored.frequencyMode === 'auto') {
    if (stored.fixedSessionsPerWeek !== null) {
      throw new Error('La frecuencia automática no debe persistir una cantidad fija')
    }

    return { mode: 'auto' }
  }

  const sessionsPerWeek = stored.fixedSessionsPerWeek
  if (
    sessionsPerWeek === null
    || !Number.isInteger(sessionsPerWeek)
    || sessionsPerWeek < 3
    || sessionsPerWeek > 5
  ) {
    throw new Error('La frecuencia fija persistida debe tener entre 3 y 5 sesiones')
  }

  return { mode: 'fixed', sessionsPerWeek }
}
