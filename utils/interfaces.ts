import { LucideIcon } from 'lucide-react'

export interface SectionHeaderProps {
  title: string
  icon?: LucideIcon
  iconColorClass?: string
  action?: React.ReactNode
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
