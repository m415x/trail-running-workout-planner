import { AthleteGroupCode } from '@/types/athlete/group.types'
import { IntensityZone } from '@/types/training/intensity.types'

export type DayStatus = 'completed' | 'partial' | 'missed' | 'pending' | 'rest'
export type WorkoutType =
  | 'Base'
  | 'Long'
  | 'Intervals'
  | 'Trail'
  | 'Speed'
  | 'Fartlek'
  | 'PAM'
  | 'Hills'
  | 'Rest'
  | 'Race'

/**
 * Vista resuelta para la UI del atleta autenticado
 */
export interface WorkoutProps {
  id?: number | string
  title: string
  type: WorkoutType
  distance: number
  zone: IntensityZone
  time: number
  gain: number
  pace: number
  notes: string
  targetGroups?: AthleteGroupCode[]
  trackPath?: string
  locationKey?: string
}

/**
 * Estructuras de navegación del calendario semanal
 */
export interface WeeklyCycle {
  id: string
  title: string
  phase: string
  startDate: string
  endDate: string
  targetKm: number
}

export interface WeekDayRaw {
  date: string
  completedKm?: number
  type?: WorkoutType
  isToday?: boolean
  isRest?: boolean
  isDone?: boolean
  isPartial?: boolean
  isMissed?: boolean
  status?: DayStatus
  workoutId?: number
}

export interface WeekDay extends WeekDayRaw {
  day?: string
  dayName?: string
  dayNumber?: number
  fullDate?: string
  km?: number
}
