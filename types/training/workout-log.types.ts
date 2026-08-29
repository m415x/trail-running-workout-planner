import { BaseEntity } from '@/types/core/base.types'
import { FeelingValue } from '@workouts/components/FeelingSelector'

/**
 * Registro de entrenamiento realizado (Strava-like + RPE)
 */
export interface LoggedWorkoutPayload {
  workoutId?: string
  date?: string // 'YYYY-MM-DD'
  distanceKm: number
  durationMin: number
  elevationGain: number
  avgHr?: number | null
  feeling?: FeelingValue
  rpe: number // 0 al 10
  athleteNotes?: string
  loggedAt: string
}

export interface WorkoutLog extends BaseEntity, LoggedWorkoutPayload {
  athleteId: string
  workoutSessionId?: string
}
