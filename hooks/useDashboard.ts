'use client'

import { useState, useMemo } from 'react'

// Simulación de base de datos / API
import { currentUser, weeklyCycle, weekDaysRaw, workouts, elevationProfiles } from '@/data/data'

// Helpers y Tipos
import { formatRawWeekDay } from '@/utils/date-helpers'
import { ElevationChartProps } from '@/utils/interfaces'

export function useDashboard() {
  // 1. Mapeo dinámico de fechas ISO ('2026-08-10') a objetos WeekDay para la UI
  const weekDays = useMemo(() => {
    return weekDaysRaw.map(formatRawWeekDay)
  }, [])

  // 2. Estado del día seleccionado (selecciona 'hoy' por defecto)
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const todayIndex = weekDays.findIndex((day) => day.isToday)
    return todayIndex !== -1 ? todayIndex : 0
  })

  // 3. Día y entrenamiento relacional activo
  const selectedWeekDay = weekDays[selectedDay]
  const workoutId = selectedWeekDay?.workoutId
  const currentWorkout = workoutId !== undefined ? workouts[workoutId] : null

  // 4. Datos calculados para el gráfico de altimetría
  const elevationChartData: ElevationChartProps | null = useMemo(() => {
    if (workoutId === undefined || !currentWorkout || !elevationProfiles[workoutId]) {
      return null
    }

    const elevData = elevationProfiles[workoutId]
    const elevMin = Math.min(...elevData.map((d) => d.elev))
    const elevMax = Math.max(...elevData.map((d) => d.elev))
    const yDomain = [Math.floor(elevMin - 50), Math.ceil(elevMax + 50)]

    return {
      workout: currentWorkout,
      elevData,
      elevMin,
      elevMax,
      yDomain,
    }
  }, [workoutId, currentWorkout])

  return {
    // Entidades / Datos
    user: currentUser,
    weeklyCycle,
    weekDays,
    selectedWeekDay,
    currentWorkout,
    elevationChartData,

    // Estado & Acciones
    selectedDay,
    onSelectDay: setSelectedDay,
  }
}
