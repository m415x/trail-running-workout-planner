import { Activity, LucideIcon } from 'lucide-react'
import { WorkoutType } from '@/types'
import { WORKOUT_TYPES_CONFIG, WorkoutTypeConfig } from '@/lib/constants'

/**
 * Retorna el ícono configurado para el tipo de rutina (o Activity por defecto).
 */
export function getWorkoutIcon(type?: WorkoutType): LucideIcon {
  if (!type) return Activity
  return WORKOUT_TYPES_CONFIG[type]?.icon ?? Activity
}

/**
 * Retorna el label formateado para el tipo de rutina (o el título / valor recibido).
 */
export function getWorkoutTypeLabel(type?: WorkoutType, fallbackTitle?: string): string {
  if (!type) return fallbackTitle ?? 'Entrenamiento'
  return WORKOUT_TYPES_CONFIG[type]?.label ?? fallbackTitle ?? type
}

/**
 * Retorna la configuración completa del tipo de rutina.
 */
export function getWorkoutTypeConfig(type?: WorkoutType): WorkoutTypeConfig {
  const fallback: WorkoutTypeConfig = {
    label: 'Entrenamiento',
    icon: Activity,
  }
  if (!type) return fallback
  return WORKOUT_TYPES_CONFIG[type] ?? fallback
}
