'use client'

import { CircleCheckBig, CircleMinus, X } from 'lucide-react'
import { WeekDay } from '@/types/interfaces'
import { getDayStatus } from '@/utils/date-helpers'
import { cn } from '@/lib/utils'

interface DayStatusIndicatorProps {
  day: WeekDay
  isSelected?: boolean
}

export function DayStatusIndicator({ day, isSelected }: DayStatusIndicatorProps) {
  const status = day.status ?? getDayStatus(day)

  // Si está seleccionado, los íconos/puntos se pintan de blanco para dar contraste sobre el fondo naranja
  if (status === 'completed') {
    return (
      <CircleCheckBig size={12} className={cn('transition-colors', isSelected ? 'text-white' : 'text-emerald-500')} />
    )
  }

  if (status === 'partial') {
    return <CircleMinus size={12} className={cn('transition-colors', isSelected ? 'text-white' : 'text-amber-500')} />
  }

  if (status === 'missed') {
    return <X size={12} className={cn('transition-colors', isSelected ? 'text-white' : 'text-red-500')} />
  }

  if (status === 'pending') {
    return (
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full transition-all',
          isSelected && 'bg-white/80',
          !isSelected && day.type === 'Long' && 'bg-primary',
          !isSelected && day.type !== 'Long' && 'bg-muted-foreground/40',
        )}
      />
    )
  }

  return null
}
