import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

export type WorkoutType = 'Base' | 'Long' | 'Intervals' | 'Z2' | 'Trail' | 'Speed' | string

export interface WeekDay {
  day: string // 'L', 'M', 'X', 'J', 'V', 'S', 'D'
  date: number // 10, 11, 12...
  isToday?: boolean
  isRest?: boolean
  done?: boolean
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
}

export interface CardHeaderProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  iconColorClass?: string
  children?: ReactNode
}

export interface WorkoutProps {
  title: string
  km: number
  zone: string
  zonePct: string
  time: string
  gain: string
  pace: string
  notes: string
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
  onViewMap?: () => void
}

export interface StatPillProps {
  icon: LucideIcon
  label: string
  value: number | string
  unit: string
}
