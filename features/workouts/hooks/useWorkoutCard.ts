'use client'

import { useState, useEffect, useMemo } from 'react'
import { Clock, Zap, Gauge } from 'lucide-react'
import { WorkoutProps, LoggedWorkoutPayload } from '@/features/workouts/types/workout.types'
import { formatPace, paceToSpeed } from '@/utils/formatters'
import { formatShortDate } from '@/utils/date-helpers'
import { fetchDailyWeather, WeatherData } from '@/lib/weather/open-meteo'

interface UseWorkoutCardProps {
  workout: WorkoutProps
  date?: string
}

export function useWorkoutCard({ workout, date }: UseWorkoutCardProps) {
  const [isLogOpen, setIsLogOpen] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [isLoadingWeather, setIsLoadingWeather] = useState(true)

  // 1. Etiqueta formateada de la fecha
  const dateLabel = useMemo(() => (date ? formatShortDate(date) : ''), [date])

  // 2. Carga reactiva del clima sin ejecuciones síncronas en cascada
  useEffect(() => {
    let isMounted = true

    const loadWeather = async () => {
      await Promise.resolve()
      if (isMounted) setIsLoadingWeather(true)

      try {
        const data = await fetchDailyWeather(-31.5375, -68.5364, date)
        if (isMounted) setWeather(data)
      } catch (error) {
        console.error('Error cargando clima:', error)
      } finally {
        if (isMounted) setIsLoadingWeather(false)
      }
    }

    loadWeather()

    return () => {
      isMounted = false
    }
  }, [date])

  // 3. Formateo de estadísticas de la rutina
  const stats = useMemo(
    () => [
      { icon: Clock, label: 'Tiempo est.', value: workout.time, unit: 'min' },
      { icon: Zap, label: 'Ritmo medio', value: formatPace(workout.pace), unit: '/km' },
      { icon: Gauge, label: 'Vel. media', value: paceToSpeed(workout.pace), unit: 'km/h' },
    ],
    [workout.time, workout.pace],
  )

  // 4. Handlers del Modal
  const openLogDialog = () => setIsLogOpen(true)
  const closeLogDialog = () => setIsLogOpen(false)

  const handleSaveSession = (data: LoggedWorkoutPayload) => {
    console.log('Sesión registrada:', data)
  }

  return {
    dateLabel,
    isLogOpen,
    weather,
    isLoadingWeather,
    stats,
    openLogDialog,
    closeLogDialog,
    handleSaveSession,
  }
}
