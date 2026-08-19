'use client'

import { RefreshCcwDot, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { WeeklyCalendarCardProps } from '@/features/workouts/types/workout.types'
import { PrimaryOutlineButton } from '@/components/ui/custom/buttons'
import { CustomCard } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import ProgressGradient from '@/components/ui/custom/progress-gradient'
import { DaySelectorButton } from '@/features/workouts/components/DaySelectorButton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { WeekCalendarPicker } from '@/features/workouts/components/WeekCalendarPicker'
import { useWeeklyCalendarCard } from '@/features/workouts/hooks/useWeeklyCalendarCard'

export function WeeklyCalendarCard({
  cycle,
  weekDays,
  selectedDay,
  selectedDate,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
  onSelectDate,
}: WeeklyCalendarCardProps) {
  const subtitleWeeklyCalendar = `Fase ${cycle.phase} · Objetivo ${cycle.targetKm} km`

  const { isPopoverOpen, setIsPopoverOpen, dateRange, currentKm, progressPercentage } = useWeeklyCalendarCard(
    cycle,
    weekDays,
  )

  return (
    <CustomCard>
      {/* Header con Popover DatePicker */}
      <CardHeader title={cycle.title} subtitle={subtitleWeeklyCalendar} icon={RefreshCcwDot}>
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger
            render={
              <PrimaryOutlineButton className='rounded-full font-mono h-0 py-3.5'>
                <CalendarIcon size={10} className='opacity-80' />
                <span>{dateRange}</span>
              </PrimaryOutlineButton>
            }
          />
          <PopoverContent className='w-auto p-2 bg-card border-border/80 rounded-2xl shadow-xl z-50' align='end'>
            <WeekCalendarPicker
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                onSelectDate(date)
                setIsPopoverOpen(false)
              }}
              onClose={() => setIsPopoverOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </CardHeader>

      {/* Slider semanal con Chevrons */}
      <div className='relative flex items-center gap-1 mt-1 -mx-2'>
        {/* Chevron Semana Anterior */}
        <button
          type='button'
          onClick={onPrevWeek}
          className='p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors active:scale-90 cursor-pointer'
          title='Semana anterior'
        >
          <ChevronLeft size={16} />
        </button>

        {/* Grid de los 7 días */}
        <div className='grid grid-cols-7 flex-1 items-start gap-1'>
          {weekDays.map((d, i) => (
            <DaySelectorButton
              key={d.fullDate ?? i}
              day={d}
              index={i}
              isSelected={selectedDay === i}
              onSelectDay={onSelectDay}
            />
          ))}
        </div>

        {/* Chevron Semana Siguiente */}
        <button
          type='button'
          onClick={onNextWeek}
          className='p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors active:scale-90 cursor-pointer'
          title='Semana siguiente'
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Barra de progreso de la semana */}
      <div className='mt-2 space-y-1.5'>
        <div className='flex justify-between text-[11px]'>
          <span className='text-muted-foreground'>Progreso semanal</span>
          <span className='text-foreground font-semibold'>
            {currentKm} km <span className='text-muted-foreground font-normal'>/ {cycle.targetKm} km</span>
          </span>
        </div>

        <ProgressGradient value={progressPercentage} />
      </div>
    </CustomCard>
  )
}
