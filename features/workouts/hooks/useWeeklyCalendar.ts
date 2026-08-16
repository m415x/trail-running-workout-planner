import { useState, useMemo, useCallback } from 'react'
import { weekDaysRaw, weeklyCycle as initialCycle, workouts } from '@/data/data'
import { WeekDay, WeeklyCycle } from '@/features/workouts/types/workout.types'
import { formatRawWeekDay, parseISODate } from '@/utils/date-helpers'

export function useWeeklyCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date(2026, 7, 16)) // Domingo 16 Ago 2026

  // 1. Obtener el lunes de la semana de la fecha activa
  const startOfWeek = useMemo(() => {
    const d = new Date(selectedDate)
    const day = d.getDay() // 0 = Domingo, 1 = Lunes...
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Ajuste a Lunes
    return new Date(d.setDate(diff))
  }, [selectedDate])

  // 2. Construir los 7 días de la semana sincronizados con los datos existentes
  const weekDays = useMemo<WeekDay[]>(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const current = new Date(startOfWeek)
      current.setDate(startOfWeek.getDate() + i)

      const isoDate = current.toISOString().split('T')[0] // 'YYYY-MM-DD'
      const existingData = weekDaysRaw.find((d) => d.date === isoDate)

      if (existingData) {
        return formatRawWeekDay(existingData)
      }

      // Fallback seguro si la semana no tiene datos cargados
      return formatRawWeekDay({
        date: isoDate,
        km: 0,
        isRest: true,
        type: 'Rest',
      })
    })
  }, [startOfWeek])

  // 3. Índice del día seleccionado (0 a 6)
  const selectedDayIndex = useMemo(() => {
    const dateStr = selectedDate.toISOString().split('T')[0]
    const idx = weekDays.findIndex((d) => d.fullDate === dateStr)
    return idx !== -1 ? idx : 0
  }, [selectedDate, weekDays])

  // 4. Ciclo activo (calcula fechas y objetivo)
  const cycle: WeeklyCycle = useMemo(() => {
    const mondayIso = weekDays[0]?.fullDate ?? initialCycle.startDate
    const sundayIso = weekDays[6]?.fullDate ?? initialCycle.endDate

    return {
      ...initialCycle,
      startDate: mondayIso,
      endDate: sundayIso,
    }
  }, [weekDays])

  // 5. Handlers de Navegación
  const goToPrevWeek = useCallback(() => {
    setSelectedDate((prev) => {
      const next = new Date(prev)
      next.setDate(prev.getDate() - 7)
      return next
    })
  }, [])

  const goToNextWeek = useCallback(() => {
    setSelectedDate((prev) => {
      const next = new Date(prev)
      next.setDate(prev.getDate() + 7)
      return next
    })
  }, [])

  const selectDayByIndex = useCallback(
    (index: number) => {
      const targetDay = weekDays[index]
      if (targetDay?.fullDate) {
        setSelectedDate(parseISODate(targetDay.fullDate))
      }
    },
    [weekDays],
  )

  const selectDateFromPicker = useCallback((date: Date | undefined) => {
    if (date) setSelectedDate(date)
  }, [])

  return {
    cycle,
    weekDays,
    selectedDay: selectedDayIndex,
    selectedDate,
    onSelectDay: selectDayByIndex,
    onPrevWeek: goToPrevWeek,
    onNextWeek: goToNextWeek,
    onSelectDate: selectDateFromPicker,
  }
}
