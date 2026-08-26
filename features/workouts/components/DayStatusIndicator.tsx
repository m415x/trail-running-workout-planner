'use client'

import { CheckIcon, MinusCircleIcon, XIcon } from '@phosphor-icons/react'
import { DayStatusIndicatorProps } from '@/types'
import { getDayStatus } from '@/lib/date-helpers'
import { cn } from '@/lib/utils'

export function DayStatusIndicator({ day, isSelected }: DayStatusIndicatorProps) {
  const status = day.status ?? getDayStatus(day)

  // Si está seleccionado, los íconos/puntos se pintan de blanco para dar contraste sobre el fondo naranja
  if (status === 'completed') {
    return <CheckIcon size={12} className={cn('transition-colors', isSelected ? 'text-white' : 'text-emerald-500')} />
  }

  if (status === 'partial') {
    return (
      <MinusCircleIcon size={12} className={cn('transition-colors', isSelected ? 'text-white' : 'text-amber-500')} />
    )
  }

  if (status === 'missed') {
    return <XIcon size={12} className={cn('transition-colors', isSelected ? 'text-white' : 'text-red-500')} />
  }

  if (status === 'pending') {
    return (
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full transition-all',
          isSelected && 'bg-white/80',
          !isSelected && 'bg-muted-foreground/40',
        )}
      />
    )
  }

  return null
}
