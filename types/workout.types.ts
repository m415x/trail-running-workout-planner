/**
 * @file Sesiones planificadas, tracks GPX, clima y logs de los atletas.
 */
import { LatLngTuple } from 'leaflet'
import { BaseEntity, IntensityZone, AthleteGroupCode } from '@/types'

export type TrainingLocationKey = 'parqueDeMayo' | 'laGranja' | 'diqueUllum'
export type DayType = 'Workout' | 'Race' | 'Rest'
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

export interface GroupVolumeOverride {
  km: number
  timeMin?: number
  intervals?: string // ej: "8x800m"
  notes?: string
}

/**
 * Sesión creada por el entrenador (Base de datos)
 */
export interface WorkoutSession extends BaseEntity {
  microcycleId?: string
  date: string // 'YYYY-MM-DD'
  title: string
  type: DayType
  zone: IntensityZone
  locationKey?: TrainingLocationKey
  gpxPath?: string
  structure?: {
    warmup: string
    mainBlock: string
    cooldown: string
  }
  defaultVolume: {
    km: number
    timeMin: number
  }
  groupOverrides?: Partial<Record<AthleteGroupCode, GroupVolumeOverride>>
  notes?: string
}

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
  gpxPath?: string
  locationKey?: TrainingLocationKey
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
  rpe: number // 1 al 10
  athleteNotes?: string
  loggedAt: string
}

export interface WorkoutLog extends BaseEntity, LoggedWorkoutPayload {
  userId: string
  workoutSessionId?: string
}

/**
 * Punto individual de un track GPX con coordenadas y elevación.
 */
export interface GpxPoint {
  lat: number
  lon: number
  ele: number
}

/**
 * Datos parseados del archivo GPX
 */
export interface GpxData {
  coordinates: [number, number][]
  elevationProfile: { km: string; elev: number; grade?: number }[]
  distanceKm: number
  gainMeters: number
  maxGradePct: number
  startCoordinates?: { lat: number; lon: number }
  endCoordinates?: { lat: number; lon: number }
}

export interface WorkoutCardProps {
  workout: WorkoutProps
  date?: string
  gpxData?: GpxData | null
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

// Props de Componentes del Dominio Workouts
export interface WeeklyCalendarCardProps {
  cycle: WeeklyCycle
  weekDays: WeekDay[]
  selectedDay: number
  selectedDate: Date
  onSelectDay: (index: number) => void
  onPrevWeek: () => void
  onNextWeek: () => void
  onSelectDate: (date: Date | undefined) => void
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

export interface RouteMapCardProps {
  title?: string
  distanceKm: number
  gainMeters?: number
  maxGradePct?: number
  positions?: LatLngTuple[] // <-- Trazada GPS para Leaflet
  mapKey?: string // <-- Prop personalizada opcional
  onUploadGpx?: () => void
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

export interface DaySelectorButtonProps {
  day: WeekDay
  index: number
  isSelected: boolean
  onSelectDay: (index: number) => void
}

export interface DayStatusIndicatorProps {
  day: WeekDay
  isSelected?: boolean
}

export interface RpeSelectorProps {
  value: number
  onChange: (val: number) => void
}
