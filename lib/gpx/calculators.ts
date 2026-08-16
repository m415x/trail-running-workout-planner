import { WeekDay } from '@/features/workouts/types/workout.types'

/**
 * Calcula los kilómetros acumulados en la semana considerando días
 * completados (100%) y días parciales.
 */
export function calculateAccumulatedKm(weekDays: WeekDay[]): number {
  return weekDays.reduce((total, day) => {
    // 1. Día completado al 100%
    if (day.isDone) {
      return total + (day.completedKm ?? day.km ?? 0)
    }

    // 2. Día parcial (ej. corrió 4 km de 8 km planificados)
    if (day.isPartial) {
      return total + (day.completedKm ?? 0)
    }

    return total
  }, 0)
}

/**
 * Calcula el porcentaje de avance semanal respecto a la meta (targetKm).
 * Retorna un entero entre 0 y 100.
 */
export function calculateProgressPercentage(currentKm: number, targetKm: number): number {
  if (!targetKm || targetKm <= 0) return 0

  const percentage = Math.round((currentKm / targetKm) * 100)
  return Math.min(Math.max(percentage, 0), 100)
}
