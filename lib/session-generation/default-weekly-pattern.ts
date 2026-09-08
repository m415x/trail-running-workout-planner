import type {
  WeeklySessionRole,
  WeeklyTrainingPattern,
  WeeklyTrainingSlot,
} from '@/types/training/session-generation.types'
import type { WorkoutTemplateCategory } from '@/types/training/workout-template.types'
import type { WorkoutType } from '@/types/training/workout.types'

interface RolePreferences {
  workoutTypes: WorkoutType[]
  templateCategories: WorkoutTemplateCategory[]
}

const ROLE_PREFERENCES: Record<WeeklySessionRole, RolePreferences> = {
  base: {
    workoutTypes: ['Base'],
    templateCategories: ['endurance'],
  },
  mountain: {
    workoutTypes: ['Trail', 'Hills'],
    templateCategories: ['mountain'],
  },
  long: {
    workoutTypes: ['Long', 'Trail', 'Fartlek'],
    templateCategories: ['endurance', 'mountain'],
  },
  quality: {
    workoutTypes: ['Intervals', 'PAM', 'Speed', 'Fartlek', 'Hills'],
    templateCategories: ['quality'],
  },
  recovery: {
    workoutTypes: ['Base'],
    templateCategories: ['recovery', 'technique', 'endurance'],
  },
  competition: {
    workoutTypes: ['Race'],
    templateCategories: ['competition'],
  },
}

/**
 * Reference week used when a group has not configured its own pattern yet.
 * Slot keys are tied to weekdays rather than roles so changing a role later
 * does not change generation identity.
 */
export const DEFAULT_WEEKLY_TRAINING_PATTERN: WeeklyTrainingPattern = {
  slots: [
    createWeeklyTrainingSlot('monday', 'base'),
    createWeeklyTrainingSlot('tuesday', 'mountain'),
    createWeeklyTrainingSlot('wednesday', 'long'),
    createWeeklyTrainingSlot('thursday', 'quality'),
    {
      ...createWeeklyTrainingSlot('saturday', 'long'),
      volumeWeight: 1.9,
      elevationWeight: 2,
    },
  ],
}

export function getRolePreferences(role: WeeklySessionRole): RolePreferences {
  return ROLE_PREFERENCES[role]
}

export function createWeeklyTrainingSlot(
  weekday: WeeklyTrainingSlot['weekday'],
  role: WeeklySessionRole,
): WeeklyTrainingSlot {
  const preferences = getRolePreferences(role)

  return {
    key: `weekly-${weekday}`,
    weekday,
    role,
    preferredWorkoutTypes: [...preferences.workoutTypes],
    preferredTemplateCategories: [...preferences.templateCategories],
  }
}
