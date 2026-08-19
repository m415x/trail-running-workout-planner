import { useState, useMemo } from 'react'
import { WeekDay, WeeklyCycle } from '@/types'
import { formatDateRange } from '@/utils/date-helpers'
import { calculateAccumulatedKm, calculateProgressPercentage } from '@/lib/gpx/calculators'

export function useWeeklyCalendarCard(cycle: WeeklyCycle, weekDays: WeekDay[]) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  // Rango de fechas legible ("Ago 10–16")
  const dateRange = useMemo(() => {
    return formatDateRange(cycle.startDate, cycle.endDate)
  }, [cycle.startDate, cycle.endDate])

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
