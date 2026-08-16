'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react'
import { DAYS_OF_WEEK, MONTHS_OF_YEAR } from '@/utils/constants'
import { WeekCalendarPickerProps } from '@/features/workouts/types/workout.types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function WeekCalendarPicker({ selectedDate, onSelectDate, onClose }: WeekCalendarPickerProps) {
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
