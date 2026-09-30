import { useState, useMemo } from 'react'
import { WeekDay, WeeklyCycle } from '@/types'
import { parseISODate } from '@/lib/date-helpers'
import { calculateAccumulatedKm, calculateProgressPercentage } from '@/lib/tracks/calculators'

export function useWeeklyCalendarCard(cycle: WeeklyCycle, weekDays: WeekDay[], presentationLocale: string) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  const dateRange = useMemo(() => {
    const start = parseISODate(cycle.startDate)
    const end = parseISODate(cycle.endDate)
    const formatter = new Intl.DateTimeFormat(presentationLocale, { month: 'short', day: 'numeric' })
    return `${formatter.format(start)}–${formatter.format(end)}`
  }, [cycle.endDate, cycle.startDate, presentationLocale])

  // Kilómetros acumulados de la semana activa
  const currentKm = useMemo(() => {
    return calculateAccumulatedKm(weekDays)
  }, [weekDays])

  // Porcentaje de progreso
  const progressPercentage = useMemo(() => {
    return calculateProgressPercentage(currentKm, cycle.targetKm)
  }, [currentKm, cycle.targetKm])

  return {
    isPopoverOpen,
    setIsPopoverOpen,
    dateRange,
    currentKm,
    progressPercentage,
  }
}
