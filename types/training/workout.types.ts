/**
 * @file Sesiones planificadas, clima y logs de los atletas.
 */
import { AthleteGroupCode } from '@/types/athlete/athlete.types'
import { BaseEntity, IntensityZone } from '@/types/core/core.types'
import { TrackData } from '@/types/route/track.types'
import { FeelingValue } from '@workouts/components/FeelingSelector'

export type DayStatus = 'completed' | 'partial' | 'missed' | 'pending' | 'rest'
export type WorkoutType =
  | 'Base'
  | 'Long'
  | 'Intervals'
  | 'Trail'
  | 'Speed'
  | 'Fartlek'
  | 'Rest'
  | 'PAM'
  | 'Hills'
  | 'Race'
  | string

/**
 * Vista resuelta para la UI del atleta autenticado
 */
export interface WorkoutProps {
  id?: number | string
  title: string
  type?: WorkoutType
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
  userId: string
  workoutSessionId?: string
}

export interface WorkoutCardProps {
  workout: WorkoutProps
  date?: string
  TrackData?: TrackData | null
}

/**
 * Datos meteorológicos de Open-Meteo
 */
export interface WeatherData {
  tempMax: number
  tempMin: number
  currentTemp?: number
  windSpeed: number
  windDirectionDeg: number
  windDirectionCardinal: string
  precipitationProb: number
  weatherCode: number
  conditionLabel?: string
  isFavorableForRunning?: boolean
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

export interface ElevationChartProps {
  workout: WorkoutProps
  elevData: { km: string; elev: number }[]
  elevMin: number
  elevMax: number
  yDomain: number[]
  xDomain?: string[]
}

export interface ElevTooltipProps {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}

export interface WeekCalendarPickerProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onClose?: () => void
}

export interface LogWorkoutDialogProps {
  isOpen?: boolean
  onClose: () => void
  workout?: WorkoutProps | null
  dateStr?: string
  onSave?: (loggedData: LoggedWorkoutPayload) => void
  onDelete?: () => void
}

export interface DayStatusIndicatorProps {
  day: WeekDay
  isSelected?: boolean
}
