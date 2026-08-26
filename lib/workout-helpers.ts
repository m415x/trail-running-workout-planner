import { PulseIcon, Icon } from '@phosphor-icons/react'
import { WorkoutType } from '@/types'
import { WORKOUT_TYPES_CONFIG, WorkoutTypeConfig } from '@/lib/constants'

/**
 * Retorna el ícono configurado para el tipo de rutina (o PulseIcon por defecto).
 */
export function getWorkoutIcon(type?: WorkoutType): Icon {
  if (!type) return PulseIcon
  return WORKOUT_TYPES_CONFIG[type]?.icon ?? PulseIcon
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
    icon: PulseIcon,
  }
  if (!type) return fallback
  return WORKOUT_TYPES_CONFIG[type] ?? fallback
}
