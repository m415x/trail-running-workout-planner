'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'

// Simulación de base de datos / API
import { currentUser, weeklyCycle as defaultCycle, weekDaysRaw, workouts, team } from '@/data/data'

// Helpers y Tipos
import { WeekDay, WeeklyCycle, GpxData, ElevationChartProps } from '@/types'
import { formatRawWeekDay, parseISODate } from '@/utils/date-helpers'
import { parseGpxFromUrl } from '@/lib/gpx/gpx-parser'

export function useHomeTab() {
  // 1. Inicializar con la fecha real actual
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())

  // Referencia para saber qué fecha estaba seleccionada sin recrear listeners
  const selectedDateRef = useRef(selectedDate)
  useEffect(() => {
    selectedDateRef.current = selectedDate
  }, [selectedDate])

  // ── 2. Listener de Reactivación de la App (Móviles / Background) ──
  useEffect(() => {
    const handleAppResume = () => {
      // Solo actuar cuando la app vuelve a estar visible en pantalla
      if (document.visibilityState === 'visible') {
        const now = new Date()
        const current = selectedDateRef.current

        // Si cambió el día del calendario, actualizamos automáticamente
        const isDifferentDay =
          now.getDate() !== current.getDate() ||
          now.getMonth() !== current.getMonth() ||
          now.getFullYear() !== current.getFullYear()

        if (isDifferentDay) {
          setSelectedDate(now)
        }
      }
    }

    // Escuchar cuando el usuario vuelve a la pestaña o desbloquea el teléfono
    document.addEventListener('visibilitychange', handleAppResume)
    window.addEventListener('focus', handleAppResume)

    return () => {
      document.removeEventListener('visibilitychange', handleAppResume)
      window.removeEventListener('focus', handleAppResume)
    }
  }, [])

  // 3. Calcular el lunes de la semana correspondiente a selectedDate
  const startOfWeek = useMemo(() => {
    const d = new Date(selectedDate)
    const day = d.getDay() // 0 = Domingo, 1 = Lunes...
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Ajuste a Lunes
    const monday = new Date(d.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    return monday
  }, [selectedDate])

  // 4. Generar dinámicamente los 7 días de la semana sincronizados con weekDaysRaw
  const weekDays = useMemo<WeekDay[]>(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const current = new Date(startOfWeek)
      current.setDate(startOfWeek.getDate() + i)

      const year = current.getFullYear()
      const month = String(current.getMonth() + 1).padStart(2, '0')
      const day = String(current.getDate()).padStart(2, '0')
      const isoDate = `${year}-${month}-${day}` // 'YYYY-MM-DD'

      const existingData = weekDaysRaw.find((d) => d.date === isoDate)

      if (existingData) {
        return formatRawWeekDay(existingData)
      }

      // Fallback seguro cuando la semana no tiene entrenamientos cargados
      return formatRawWeekDay({
        date: isoDate,
        isRest: true,
        type: 'Rest',
      })
    })
  }, [startOfWeek])

  // 5. Índice del día seleccionado dentro de la semana activa (0 a 6)
  const selectedDay = useMemo(() => {
    const year = selectedDate.getFullYear()
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
    const day = String(selectedDate.getDate()).padStart(2, '0')
    const targetIso = `${year}-${month}-${day}`

    const idx = weekDays.findIndex((d) => d.fullDate === targetIso)
    return idx !== -1 ? idx : 0
  }, [selectedDate, weekDays])

  // 6. Ciclo semanal con fechas dinámicas actualizadas
  const weeklyCycle: WeeklyCycle = useMemo(() => {
    const mondayIso = weekDays[0]?.fullDate ?? defaultCycle.startDate
    const sundayIso = weekDays[6]?.fullDate ?? defaultCycle.endDate

    return {
      ...defaultCycle,
      startDate: mondayIso,
      endDate: sundayIso,
    }
  }, [weekDays])

  // 7. Rutina activa asociada al día seleccionado
  const selectedWeekDay = weekDays[selectedDay]
  const workoutId = selectedWeekDay?.workoutId
  const currentWorkout = workoutId !== undefined ? workouts[workoutId] : null

  // 8. Estado y carga reactiva del track GPX
  const [gpxData, setGpxData] = useState<GpxData | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadGpx = async () => {
      if (!currentWorkout?.gpxPath) {
        await Promise.resolve()
        if (isMounted) setGpxData(null)
        return
      }

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

  // 9. Datos calculados de altimetría
  const elevationChartData: ElevationChartProps | null = useMemo(() => {
    if (!currentWorkout || !gpxData || gpxData.elevationProfile.length === 0) {
      return null
    }

    const elevs = gpxData.elevationProfile.map((d: { elev: number }) => d.elev)
    const elevMin = Math.min(...elevs)
    const elevMax = Math.max(...elevs)

    return {
      workout: {
        ...currentWorkout,
        km: gpxData.distanceKm || currentWorkout.distance,
        gain: gpxData.gainMeters || currentWorkout.gain,
      },
      elevData: gpxData.elevationProfile,
      elevMin,
      elevMax,
      yDomain: [Math.floor(elevMin - 30), Math.ceil(elevMax + 30)],
    }
  }, [currentWorkout, gpxData])

  // 10. Funciones de navegación entre semanas y selección de fechas
  const handlePrevWeek = useCallback(() => {
    setSelectedDate((prev) => {
      const next = new Date(prev)
      next.setDate(prev.getDate() - 7)
      return next
    })
  }, [])

  const handleNextWeek = useCallback(() => {
    setSelectedDate((prev) => {
      const next = new Date(prev)
      next.setDate(prev.getDate() + 7)
      return next
    })
  }, [])

  const handleSelectDay = useCallback(
    (index: number) => {
      const target = weekDays[index]
      if (target?.fullDate) {
        setSelectedDate(parseISODate(target.fullDate))
      }
    },
    [weekDays],
  )

  const handleSelectDate = useCallback((date: Date | undefined) => {
    if (date) setSelectedDate(date)
  }, [])

  return {
    team,
    user: currentUser,
    weeklyCycle,
    weekDays,
    selectedDay,
    selectedDate,
    selectedWeekDay,
    currentWorkout,
    elevationChartData,
    gpxData,
    onSelectDay: handleSelectDay,
    onPrevWeek: handlePrevWeek,
    onNextWeek: handleNextWeek,
    onSelectDate: handleSelectDate,
  }
}
