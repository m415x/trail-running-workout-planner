'use client'

import { useState, useEffect, useMemo } from 'react'

// Simulación de base de datos / API
import { currentUser, weeklyCycle, weekDaysRaw, workouts } from '@/data/data'

// Helpers y Tipos
import { ElevationChartProps } from '@/features/workouts/types/workout.types'
import { formatRawWeekDay } from '@/utils/date-helpers'
import { parseGpxFromUrl, GpxData } from '@/lib/gpx/gpx-parser'

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

  // 4. Estado para guardar los datos parseados del GPX activo
  const [gpxData, setGpxData] = useState<GpxData | null>(null)

  // 5. Cargar y parsear GPX dinámicamente cuando cambia la rutina
  useEffect(() => {
    let isMounted = true

    const loadGpx = async () => {
      if (!currentWorkout?.gpxPath) {
        // 1. Diferimos la llamada para evitar el setState síncrono dentro del effect body
        await Promise.resolve()
        if (isMounted) setGpxData(null)
        return
      }

      // 2. Parseo asíncrono normal del archivo GPX
      const data = await parseGpxFromUrl(currentWorkout.gpxPath)
      if (isMounted) {
        setGpxData(data)
      }
    }

    loadGpx()

    return () => {
      isMounted = false
    }
  }, [currentWorkout?.gpxPath])

  // 6. Datos calculados para la altimetría derivados del GPX
  const elevationChartData: ElevationChartProps | null = useMemo(() => {
    if (!currentWorkout || !gpxData || gpxData.elevationProfile.length === 0) {
      return null
    }

    const elevs = gpxData.elevationProfile.map((d) => d.elev)
    const elevMin = Math.min(...elevs)
    const elevMax = Math.max(...elevs)

    return {
      workout: {
        ...currentWorkout,
        km: gpxData.distanceKm || currentWorkout.km,
        gain: gpxData.gainMeters || currentWorkout.gain,
      },
      elevData: gpxData.elevationProfile,
      elevMin,
      elevMax,
      yDomain: [Math.floor(elevMin - 30), Math.ceil(elevMax + 30)],
    }
  }, [currentWorkout, gpxData])

  return {
    user: currentUser,
    weeklyCycle,
    weekDays,
    selectedWeekDay,
    currentWorkout,
    elevationChartData,
    gpxData, // Expuesto para pasarlo al mapa Leaflet
    selectedDay,
    onSelectDay: setSelectedDay,
  }
}
