import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

export type NavigationTab = 'home' | 'plan' | 'stats' | 'profile'

export interface CardHeaderProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  iconColorClass?: string
  children?: ReactNode
}

export interface StatPillProps {
  icon: LucideIcon
  label: string
  value: number | string
  unit: string
  className?: string
}
