'use client'

import { createElement } from 'react'
import { WeekDay } from '@/types'
import { getWorkoutIcon } from '@/lib/workout-helpers'
import { DayStatusIndicator } from '@workouts/components/DayStatusIndicator'
import { cn } from '@/lib/utils'

export interface DaySelectorButtonProps {
  day: WeekDay
  index: number
  isSelected: boolean
  hideStatusIndicators?: boolean
  onSelectDay: (index: number) => void
}

/** Weekly calendar button. Status is resolved upstream; this component only renders it. */
export function DaySelectorButton({
  day,
  index,
  isSelected,
  hideStatusIndicators = false,
  onSelectDay,
}: DaySelectorButtonProps) {
  const icon = getWorkoutIcon(day.type ?? (day.isRest ? 'Rest' : 'Base'))

  return (
    <div className='p-0 flex flex-col items-center justify-center gap-1.5'>
      <button
        type='button'
        onClick={() => onSelectDay(index)}
        className={cn(
          'flex flex-col items-center w-full rounded-[18px] py-2 px-1 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40',
          isSelected && 'bg-primary text-white border border-primary shadow-lg shadow-primary/30',
          !isSelected && day.isToday && 'bg-primary/15 border border-primary/30',
          !isSelected && !day.isToday && 'bg-transparent hover:bg-secondary/40',
          !isSelected && day.isRest && 'opacity-60 hover:opacity-100',
        )}
      >
        <div className='mb-1 flex items-center justify-center h-3.5'>
          {!hideStatusIndicators &&
            !day.isRest &&
            createElement(icon, {
              size: 12,
              className: cn(
                'transition-colors',
                isSelected ? 'text-white' : day.isToday ? 'text-primary' : 'text-muted-foreground/70',
              ),
            })}
        </div>

        <span className={cn('text-[10px] font-semibold mb-0.5', isSelected ? 'text-white' : 'text-muted-foreground')}>
          {day.day}
        </span>

        <span
          className={cn(
            'font-heading text-lg font-bold leading-none',
            isSelected ? 'text-white' : day.isToday ? 'text-foreground' : 'text-foreground/70',
          )}
        >
          {day.dayNumber}
        </span>

        <div className='mt-1.5 h-2 flex items-center justify-center'>
          {!hideStatusIndicators && <DayStatusIndicator day={day} isSelected={isSelected} />}
        </div>
      </button>
      {day.isToday && (
        <span className='font-heading text-[10px] font-bold leading-none text-foreground/60'>HOY</span>
      )}
      {!day.isToday && <span className='h-2.5' />}
    </div>
  )
}
