import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

export interface DayConfig {
  index: number
  short: string
  medium: string
  full: string
}

export interface MonthConfig {
  index: number
  short: string
  full: string
}

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

export interface WeekDay {
  day: string
  date: number
  km?: number
  completedKm?: number
  isToday?: boolean
  isRest?: boolean
  isDone?: boolean
  isPartial?: boolean
  isMissed?: boolean
  status?: DayStatus
  type?: WorkoutType
}

export interface WeeklyCalendarCardProps {
  title?: string
  phase?: string
  targetKm?: number
  currentKm?: number
  dateRange?: string
  weekDays: WeekDay[]
  selectedDay: number
  onSelectDay: (index: number) => void
  onViewCalendar?: () => void
}

export interface CardHeaderProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  iconColorClass?: string
  children?: ReactNode
}

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

export interface WorkoutProps {
  title: string
  km: number
  zone: hrZone
  time: number
  gain: number
  pace: number
  notes: string
}

export interface StatPillProps {
  icon: LucideIcon
  label: string
  value: number | string
  unit: string
  className?: string
}

export interface ElevTooltipProps {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}

export interface ElevationChartProps {
  workout: WorkoutProps
  elevData: { km: string; elev: number }[]
  elevMin: number
  elevMax: number
  yDomain: number[]
  xDomain?: string[]
}

export interface TodayWorkoutCardProps {
  workout: WorkoutProps
  dateLabel?: string
}

export interface RouteMapCardProps {
  title?: string
  distanceKm?: number
  gainMeters?: number
  maxGradePct?: number
  onUploadGpx?: () => void
}
