'use client'

import { useState, useEffect, useMemo } from 'react'
import { isBefore, startOfDay, parseISO, format } from 'date-fns'
import { Clock, Zap, Gauge } from 'lucide-react'
import { toast } from 'sonner'
import { WorkoutCardProps, LoggedWorkoutPayload, GpxData } from '@/types'
import { TRAINING_LOCATIONS, DEFAULT_FALLBACK_LOCATION } from '@/data/data'
import { formatPace, paceToSpeed } from '@/utils/formatters'
import { formatShortDate } from '@/utils/date-helpers'
import { fetchDailyWeather, WeatherData } from '@/lib/weather/open-meteo'
import { getWorkoutIcon, getWorkoutTypeLabel } from '@/utils/workout-helpers'

interface UseWorkoutCardParams {
  workout: WorkoutCardProps['workout']
  date?: string
  gpxData?: GpxData | null
  isCompleted?: boolean
}

export function useWorkoutCard({
  workout,
  date,
  gpxData,
  isCompleted: initialIsCompleted = false,
}: UseWorkoutCardParams) {
  const [isLogOpen, setIsLogOpen] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [isLoadingWeather, setIsLoadingWeather] = useState(true)
  const [isLogged, setIsLogged] = useState(initialIsCompleted)

  // Obtenemos dinámicamente el icono y el título
  const headerTitle = getWorkoutTypeLabel(workout.type, workout.title)
  const WorkoutIcon = getWorkoutIcon(workout.type)

  // 1. Etiqueta formateada de la fecha
  const dateLabel = useMemo(() => (date ? formatShortDate(date) : ''), [date])

  // 2. Determinar si la fecha es pasada
  const isPast = useMemo(() => {
    if (!date) return false
    const workoutDay = startOfDay(parseISO(date))
    const today = startOfDay(new Date())
    return isBefore(workoutDay, today)
  }, [date])

  // 3. Resolución de Coordenadas por Prioridad
  const targetCoordinates = useMemo(() => {
    // Si hay GPX (montaña / carrera / circuito externo), usamos el punto de inicio
    if (gpxData?.startCoordinates) {
      return gpxData.startCoordinates
    }

    // Si el workout define una ubicación específica (pista en La Granja o cuestas en Ullum)
    if (workout.locationKey && TRAINING_LOCATIONS[workout.locationKey]) {
      return TRAINING_LOCATIONS[workout.locationKey]
    }

    // Fallback: Parque de Mayo (calle)
    return DEFAULT_FALLBACK_LOCATION
  }, [gpxData, workout.locationKey])

  // 4. Carga reactiva del clima sin ejecuciones síncronas en cascada (solo si NO es pasado)
  useEffect(() => {
    let isMounted = true

    const loadWeather = async () => {
      await Promise.resolve()

      // Si es una fecha pasada, limpiamos estado y salimos
      if (isPast || !date) {
        if (isMounted) {
          setWeather(null)
          setIsLoadingWeather(false)
        }
        return
      }

      if (isMounted) setIsLoadingWeather(true)

      try {
        // Obtenemos clima solo para fechas futuras u hoy
        const data = await fetchDailyWeather(-31.529822, -68.5440881, date)
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
  }, [date, isPast, targetCoordinates.lat, targetCoordinates.lon])

  // 5. Formateo de estadísticas de la rutina
  const stats = useMemo(
    () => [
      { icon: Clock, label: 'Tiempo est.', value: workout.time, unit: 'min' },
      { icon: Zap, label: 'Ritmo medio', value: formatPace(workout.pace), unit: '/km' },
      { icon: Gauge, label: 'Vel. media', value: paceToSpeed(workout.pace), unit: 'km/h' },
    ],
    [workout.time, workout.pace],
  )

  // 6. Handlers del Modal
  const openLogDialog = () => setIsLogOpen(true)
  const closeLogDialog = () => setIsLogOpen(false)

  const handleSaveSession = (data: LoggedWorkoutPayload) => {
    console.log('Sesión registrada:', data)
    toast.success('Entrenamiento registrado con éxito', { description: format(new Date(), 'eeee, dd MMMM') })
    setIsLogged(true)
  }

  return {
    WorkoutIcon,
    headerTitle,
    dateLabel,
    isLogOpen,
    weather,
    isLoadingWeather,
    isPast,
    isLogged,
    stats,
    openLogDialog,
    closeLogDialog,
    handleSaveSession,
  }
}
