'use client'

import { createElement } from 'react'
import { DaySelectorButtonProps } from '@/features/workouts/types/workout.types'
import { getWorkoutIcon } from '@/utils/workout-helpers'
import { DayStatusIndicator } from '@/features/workouts/components/DayStatusIndicator'
import { cn } from '@/lib/utils'

export function DaySelectorButton({ day, index, isSelected, onSelectDay }: DaySelectorButtonProps) {
  // Obtenemos la referencia al icono
  const icon = getWorkoutIcon(day.type ?? (day.isRest ? 'Rest' : 'Base'))

  return (
    <div className='p-0 flex flex-col items-center justify-center gap-1.5'>
      <button
        type='button'
        onClick={() => onSelectDay(index)}
        className={cn(
          'flex flex-col items-center w-full rounded-[18px] py-2 px-1 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40',
          // ── Estado Seleccionado (Aplica igual aunque sea Descanso) ──
          isSelected && 'bg-primary text-white border border-primary shadow-lg shadow-primary/30',

          // ── Estados NO Seleccionados ──
          !isSelected && day.isToday && 'bg-primary/15 border border-primary/30',
          !isSelected && !day.isToday && 'bg-transparent hover:bg-secondary/40',

          // ── Apariencia atenuada/muted para Días de Descanso no activos ──
          !isSelected && day.isRest && 'opacity-60 hover:opacity-100',
        )}
      >
        {/* Ícono superior según el WorkoutType */}
        <div className='mb-1 flex items-center justify-center h-3.5'>
          {createElement(icon, {
            size: 12,
            className: cn(
              'transition-colors',
              isSelected ? 'text-white' : day.isToday ? 'text-primary' : 'text-muted-foreground/70',
            ),
          })}
        </div>

        {/* Día de la semana (L, M, X...) */}
        <span className={cn('text-[10px] font-semibold mb-0.5', isSelected ? 'text-white' : 'text-muted-foreground')}>
          {day.day}
        </span>

        {/* Número de fecha (10, 11, 12...) */}
        <span
          className={cn(
            'font-heading text-lg font-bold leading-none',
            isSelected ? 'text-white' : day.isToday ? 'text-foreground' : 'text-foreground/70',
          )}
        >
          {day.date}
        </span>

        {/* Indicador inferior de estado (Check / Minus / Dot / X) */}
        <div className='mt-1.5 h-2 flex items-center justify-center'>
          <DayStatusIndicator day={day} isSelected={isSelected} />
        </div>
      </button>
      {day.isToday && (
        <span className={cn('font-heading text-[10px] font-bold leading-none text-foreground/60')}>HOY</span>
      )}
      {!day.isToday && <span className={cn('h-2.5')}></span>}
    </div>
  )
}
