import { LatLngTuple } from 'leaflet'
import { WeeklyCycle, WeekDay, WorkoutProps, LoggedWorkoutPayload } from '@/types'

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
