'use client'

import { CheckCircle2, RefreshCcwDot } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { DefaultButton } from '@/components/ui/custom/buttons'
import { CustomCard } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { cn } from '@/lib/utils'
import { WeeklyCalendarCardProps } from '@/utils/interfaces'

export function WeeklyCalendarCard({
  title = 'Microciclo',
  phase = 'Choque',
  targetKm = 45,
  currentKm = 8,
  dateRange = 'Ago 10–16',
  weekDays = [],
  selectedDay,
  onSelectDay,
  onViewCalendar,
}: WeeklyCalendarCardProps) {
  // Cálculo automático del porcentaje de progreso
  const progressPercentage = targetKm > 0 ? Math.min(Math.round((currentKm / targetKm) * 100), 100) : 0

  const subtitleWeeklyCalendar = `Fase ${phase} · Objetivo ${targetKm} km`

  return (
    <CustomCard>
      {/* Header */}
      <CardHeader title={title} subtitle={subtitleWeeklyCalendar} icon={RefreshCcwDot}>
        <DefaultButton className='font-mono' onClick={onViewCalendar}>
          {dateRange}
        </DefaultButton>
      </CardHeader>

      {/* Day columns */}
      <div className='grid grid-cols-7 gap-1'>
        {weekDays.map((d, i) => {
          const isSelected = selectedDay === i
          const hasWorkout = !d.isRest

          return (
            <button
              key={i}
              type='button'
              onClick={() => hasWorkout && onSelectDay(i)}
              disabled={d.isRest}
              className={cn(
                'flex flex-col items-center rounded-[18px] py-2.5 px-1 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40',
                isSelected && 'bg-primary text-white border border-primary shadow-lg shadow-primary/30',
                !isSelected && d.isToday && 'bg-primary/15 border border-primary/30',
                !isSelected && !d.isToday && 'bg-transparent hover:bg-secondary/40',
              )}
            >
              {/* Día de la semana (LUN, MAR...) */}
              <span
                className={cn('text-[10px] font-semibold mb-1', isSelected ? 'text-white' : 'text-muted-foreground')}
              >
                {d.day}
              </span>

              {/* Número de fecha (10, 11, 12...) */}
              <span
                className={cn(
                  'font-heading text-base font-bold leading-none',
                  isSelected ? 'text-white' : d.isToday ? 'text-foreground' : 'text-foreground/70',
                )}
              >
                {d.date}
              </span>

              {/* Indicador inferior (Check / Dot) */}
              <div className='mt-1.5 h-2 flex items-center justify-center'>
                {d.done ? (
                  <CheckCircle2 size={12} className={isSelected ? 'text-white' : 'text-hr-z3'} />
                ) : hasWorkout ? (
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      isSelected && 'bg-white/80',
                      !isSelected && d.type === 'Long' && 'bg-secondary',
                      !isSelected && d.type !== 'Long' && 'bg-muted-foreground/40',
                    )}
                  />
                ) : null}
              </div>
            </button>
          )
        })}
      </div>

      {/* Weekly progress */}
      <div className='mt-4 space-y-1.5'>
        <div className='flex justify-between text-[11px]'>
          <span className='text-muted-foreground'>Progreso semanal</span>
          <span className='text-foreground font-semibold'>
            {currentKm} km <span className='text-muted-foreground font-normal'>/ {targetKm} km</span>
          </span>
        </div>

        <Progress value={progressPercentage} className='rounded-full' />
      </div>
    </CustomCard>
  )
}
