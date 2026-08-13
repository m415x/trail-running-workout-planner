'use client'

import { useMemo } from 'react'
import { RefreshCcwDot } from 'lucide-react'
import { DefaultButton } from '@/components/ui/custom/buttons'
import { CustomCard } from '@/components/ui/custom/card-containers'
import { CardHeader } from '@/components/ui/custom/section-header'
import { WeeklyCalendarCardProps } from '@/utils/interfaces'
import ProgressGradient from '@/components/ui/custom/progress-gradient'
import { DaySelectorButton } from '@/components/blocks/DaySelectorButton'
import { calculateProgressPercentage } from '@/utils/calculators'

export function WeeklyCalendarCard({
  title = 'Microciclo',
  phase = 'Base',
  targetKm = 0,
  currentKm = 0,
  dateRange = 'Ago 10–16',
  weekDays = [],
  selectedDay,
  onSelectDay,
  onViewCalendar,
}: WeeklyCalendarCardProps) {
  const subtitleWeeklyCalendar = `Fase ${phase} · Objetivo ${targetKm} km`

  // Porcentaje para la barra de progreso
  const progressPercentage = useMemo(() => {
    return calculateProgressPercentage(currentKm, targetKm)
  }, [currentKm, targetKm])

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
        {weekDays.map((d, i) => (
          <DaySelectorButton key={i} day={d} index={i} isSelected={selectedDay === i} onSelectDay={onSelectDay} />
        ))}
      </div>

      {/* Weekly progress */}
      <div className='mt-4 space-y-1.5'>
        <div className='flex justify-between text-[11px]'>
          <span className='text-muted-foreground'>Progreso semanal</span>
          <span className='text-foreground font-semibold'>
            {currentKm} km <span className='text-muted-foreground font-normal'>/ {targetKm} km</span>
          </span>
        </div>

        <ProgressGradient value={progressPercentage} />
      </div>
    </CustomCard>
  )
}
