import { useState, useMemo } from 'react'
import { MONTHS_OF_YEAR } from '@/utils/constants'
import { WeekCalendarPickerProps } from '@/types'

export function useWeekCalendarPicker({ selectedDate, onSelectDate, onClose }: WeekCalendarPickerProps) {
  // Mes visible en el calendario (por defecto el de la fecha seleccionada)
  const [viewDate, setViewDate] = useState<Date>(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))

  const currentYear = viewDate.getFullYear()
  const currentMonthIdx = viewDate.getMonth()
  const monthName = MONTHS_OF_YEAR[currentMonthIdx]?.full ?? ''

  // Calcular el rango (Lunes a Domingo) de la semana seleccionada
  const selectedWeekRange = useMemo(() => {
    const d = new Date(selectedDate)
    const day = d.getDay()
    const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diffToMonday))
    monday.setHours(0, 0, 0, 0)

    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)

    return { monday, sunday }
  }, [selectedDate])

  // Generar la matriz de días para la cuadrícula del mes
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonthIdx, 1)
    const lastDayOfMonth = new Date(currentYear, currentMonthIdx + 1, 0)

    // Ajuste de inicio: 0 = Lunes, 6 = Domingo
    const startDayIndex = (firstDayOfMonth.getDay() + 6) % 7
    const daysInMonth = lastDayOfMonth.getDate()

    const days: { date: Date; isCurrentMonth: boolean }[] = []

    // Días del mes anterior para completar la primera fila
    const prevMonthLastDay = new Date(currentYear, currentMonthIdx, 0).getDate()
    for (let i = startDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(currentYear, currentMonthIdx - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      })
    }

    // Días del mes actual
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(currentYear, currentMonthIdx, i),
        isCurrentMonth: true,
      })
    }

    // Días del mes siguiente para completar hasta múltiplos de 7
    const remaining = (7 - (days.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(currentYear, currentMonthIdx + 1, i),
        isCurrentMonth: false,
      })
    }

    return days
  }, [currentYear, currentMonthIdx])

  // Navegación por mes
  const prevMonth = () => {
    setViewDate(new Date(currentYear, currentMonthIdx - 1, 1))
  }

  const nextMonth = () => {
    setViewDate(new Date(currentYear, currentMonthIdx + 1, 1))
  }

  // Ir al día de hoy
  const handleGoToday = () => {
    const today = new Date()
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
    onSelectDate(today)
    onClose?.()
  }

  // Chequeo de hoy
  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  // Chequeo de día seleccionado
  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    )
  }

  // Chequeo si el día forma parte de la semana activa
  const isInSelectedWeek = (date: Date) => {
    return date >= selectedWeekRange.monday && date <= selectedWeekRange.sunday
  }
  return {
    currentYear,
    monthName,
    calendarDays,
    prevMonth,
    nextMonth,
    handleGoToday,
    isToday,
    isSelected,
    isInSelectedWeek,
  }
}
