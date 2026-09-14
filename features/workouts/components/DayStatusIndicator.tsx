'use client'

import { CheckIcon, MinusCircleIcon, PlusCircleIcon, XIcon } from '@phosphor-icons/react'
import { WeekDay } from '@/types'
import { getDayStatus } from '@/lib/date-helpers'
import { cn } from '@/lib/utils'

export interface DayStatusIndicatorProps {
  day: WeekDay
  isSelected?: boolean
}

/**
 * Purely visual representation of the already-resolved calendar state.
 * `hasUnplannedTraining` is orthogonal to planned-session compliance: the plus
 * means durable training exists without an official session link.
 */
export function DayStatusIndicator({ day, isSelected }: DayStatusIndicatorProps) {
  const status = day.status ?? getDayStatus(day)

  if (status === 'rest' && day.hasUnplannedTraining) {
    return (
      <PlusCircleIcon
        size={12}
        weight='bold'
        className={cn('transition-colors', isSelected ? 'text-white' : 'text-sky-500')}
      />
    )
  }

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
