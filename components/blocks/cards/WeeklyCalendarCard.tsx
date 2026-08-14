'use client'

import { useMemo } from 'react'
import { RefreshCcwDot } from 'lucide-react'
import { DefaultButton } from '@/components/ui/custom/buttons'
import { CustomCard } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { WeeklyCalendarCardProps } from '@/utils/interfaces'
import ProgressGradient from '@/components/ui/custom/progress-gradient'
import { DaySelectorButton } from '@/components/blocks/DaySelectorButton'
import { formatDateRange } from '@/utils/date-helpers'
import { calculateAccumulatedKm, calculateProgressPercentage } from '@/utils/calculators'

export function WeeklyCalendarCard({
  cycle,
  weekDays,
  selectedDay,
  onSelectDay,
  onViewCalendar,
}: WeeklyCalendarCardProps) {
  const subtitleWeeklyCalendar = `Fase ${cycle.phase} · Objetivo ${cycle.targetKm} km`

  // Rango de fechas ("Ago 10–16")
  const dateRange = useMemo(() => {
    return formatDateRange(cycle.startDate, cycle.endDate)
  }, [cycle.startDate, cycle.endDate])

  // Kilómetros acumulados
  const currentKm = useMemo(() => {
    return calculateAccumulatedKm(weekDays)
  }, [weekDays])

  // Porcentaje de progreso
  const progressPercentage = useMemo(() => {
    return calculateProgressPercentage(currentKm, cycle.targetKm)
  }, [currentKm, cycle.targetKm])

  return (
    <CustomCard>
      {/* Header */}
      <CardHeader title={cycle.title} subtitle={subtitleWeeklyCalendar} icon={RefreshCcwDot}>
        <DefaultButton className='font-mono' onClick={onViewCalendar}>
          {dateRange}
        </DefaultButton>
      </CardHeader>

      {/* Grid de 7 días */}
      <div className='grid grid-cols-7 gap-1'>
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

      {/* Progreso semanal */}
      <div className='mt-4 space-y-1.5'>
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
