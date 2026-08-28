import { ReactNode } from 'react'
import { Icon } from '@phosphor-icons/react'

export type NavigationTab = 'home' | 'plan' | 'stats' | 'profile'

export interface CardHeaderProps {
  title: string
  subtitle?: string
  icon?: Icon
  iconColorClass?: string
  children?: ReactNode
}

export interface StatPillProps {
  icon: Icon
  label: string
  value: number | string
  unit: string
  className?: string
}
