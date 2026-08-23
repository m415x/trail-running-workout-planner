'use client'

import { RefreshCcwDot, Calendar as CalendarIcon } from 'lucide-react'
import { WeeklyCalendarCardProps } from '@/types'
import { PrimaryOutlineButton } from '@ui/custom/buttons'
import { CustomCard } from '@ui/custom/card-containers'
import { CardHeader } from '@ui/custom/section-header'
import ProgressGradient from '@ui/custom/progress-gradient'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/popover'
import { WeekCalendarPicker } from '@workouts/components/WeekCalendarPicker'
import { useWeeklyCalendarCard } from '@workouts/hooks/useWeeklyCalendarCard'
import { WeeklyCarousel } from '@workouts/components/WeeklyCarousel'

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
              <PrimaryOutlineButton className='rounded-full font-xs font-mono h-0 py-3.5'>
                <CalendarIcon className='size-3! opacity-80' />
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

      {/* Carrusel semanal*/}
      <WeeklyCarousel
        weekDays={weekDays}
        selectedDay={selectedDay}
        onSelectDay={onSelectDay}
        onPrevWeek={onPrevWeek}
        onNextWeek={onNextWeek}
      />

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
