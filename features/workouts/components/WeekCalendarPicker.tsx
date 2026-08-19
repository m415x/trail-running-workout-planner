'use client'

import { ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react'
import { DAYS_OF_WEEK } from '@/utils/constants'
import { WeekCalendarPickerProps } from '@/types'
import { useWeekCalendarPicker } from '@/features/workouts/hooks/useWeekCalendarPicker'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function WeekCalendarPicker({ selectedDate, onSelectDate, onClose }: WeekCalendarPickerProps) {
  const {
    currentYear,
    monthName,
    calendarDays,
    prevMonth,
    nextMonth,
    handleGoToday,
    isToday,
    isSelected,
    isInSelectedWeek,
  } = useWeekCalendarPicker({ selectedDate, onSelectDate, onClose })

  return (
    <div className='w-68 p-2 select-none font-sans'>
      {/* ── Cabecera de Mes y Navegación ── */}
      <div className='flex items-center justify-between mb-3 px-1'>
        <span className='font-heading font-bold text-sm text-foreground'>
          {monthName} <span className='font-normal text-muted-foreground'>{currentYear}</span>
        </span>

        <div className='flex items-center gap-1'>
          <button
            type='button'
            onClick={prevMonth}
            className='p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors'
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type='button'
            onClick={nextMonth}
            className='p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors'
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Días de la Semana (2 Letras) ── */}
      <div className='grid grid-cols-7 text-center mb-1'>
        {DAYS_OF_WEEK.map((d) => (
          <span key={d.twoLetter} className='text-[11px] font-semibold text-muted-foreground uppercase'>
            {d.twoLetter}
          </span>
        ))}
      </div>

      {/* ── Grilla de Días del Mes ── */}
      <div className='grid grid-cols-7 gap-y-1 text-center'>
        {calendarDays.map(({ date, isCurrentMonth }, idx) => {
          const inWeek = isInSelectedWeek(date)
          const selected = isSelected(date)
          const today = isToday(date)

          return (
            <button
              key={idx}
              type='button'
              onClick={() => {
                onSelectDate(date)
                onClose?.()
              }}
              className={cn(
                'size-8 mx-auto flex items-center justify-center rounded-xl text-xs font-mono transition-all cursor-pointer',
                !isCurrentMonth && 'text-muted-foreground/30 hover:text-muted-foreground',
                isCurrentMonth && !selected && !inWeek && 'text-foreground hover:bg-secondary/60',
                inWeek && !selected && isCurrentMonth && 'bg-primary/10 text-primary font-semibold',
                selected && 'bg-primary text-white font-bold shadow-md scale-105',
                today && !selected && 'ring-1 ring-primary text-primary font-bold',
              )}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>

      {/* ── Footer: Botón "Hoy" ── */}
      <div className='mt-3 pt-2 border-t border-border/50 flex items-center justify-between'>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={handleGoToday}
          className='h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 rounded-lg'
        >
          <CalendarCheck size={13} />
          <span>Hoy</span>
        </Button>

        <span className='text-[10px] text-muted-foreground font-mono'>Semana seleccionada</span>
      </div>
    </div>
  )
}
