import { Activity, LucideIcon } from 'lucide-react'
import { WorkoutType } from '@/features/workouts/types/workout.types'
import { WORKOUT_TYPE_ICONS } from '@/utils/constants'

/**
 * Retorna el ícono correspondiente al tipo de entrenamiento.
 */
export function getWorkoutIcon(type?: WorkoutType): LucideIcon {
  if (!type) return Activity
  return WORKOUT_TYPE_ICONS[type] ?? Activity
}
