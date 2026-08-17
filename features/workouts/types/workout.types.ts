import { LatLngTuple } from 'leaflet'

// Estados y Tipos de rutina
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

export type hrZone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'

export interface HrZoneConfig {
  name: string
  pct: string
  rpe: string
  workType: string
  description: string
  styles: {
    bg: string
    border: string
    text: string
    textMuted: string
  }
}

export type TrainingLocationKey = 'parqueDeMayo' | 'laGranja' | 'diqueUllum'

export interface WorkoutProps {
  title: string
  km: number
  zone: hrZone
  time: number
  gain: number
  pace: number
  notes: string
  gpxPath?: string
  locationKey?: TrainingLocationKey
}

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

export interface WeekDay {
  day?: string
  date: string | number
  fullDate?: string
  type?: WorkoutType
  km?: number
  completedKm?: number
  isToday?: boolean
  isRest?: boolean
  isDone?: boolean
  isPartial?: boolean
  isMissed?: boolean
  status?: DayStatus
  workoutId?: number
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
  distanceKm?: number
  gainMeters?: number
  maxGradePct?: number
  positions?: LatLngTuple[]
  mapKey?: string
  onUploadGpx?: () => void
}

export interface WeekCalendarPickerProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onClose?: () => void
}

export interface LoggedWorkoutPayload {
  workoutId?: string
  date?: string
  distanceKm: number
  durationMin: number
  elevationGain: number
  avgHr: number | null
  rpe: number
  athleteNotes: string
  loggedAt: string
}

export interface LogWorkoutDialogProps {
  isOpen: boolean
  onClose: () => void
  workout?: WorkoutProps | null
  dateStr?: string
  onSave?: (loggedData: LoggedWorkoutPayload) => void
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

export interface ExtendedRouteMapCardProps {
  title: string
  distanceKm: number
  gainMeters: number
  maxGradePct?: number
  positions?: LatLngTuple[] // <-- Trazada GPS para Leaflet
  mapKey?: string // <-- Prop personalizada opcional
  onUploadGpx?: () => void
}

export interface RpeSelectorProps {
  value: number
  onChange: (val: number) => void
}
