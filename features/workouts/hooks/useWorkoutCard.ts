'use client'

import { useState, useEffect, useMemo } from 'react'
import { isBefore, startOfDay, parseISO, format } from 'date-fns'
import { Clock, Zap, Gauge } from 'lucide-react'
import { toast } from 'sonner'
import { WorkoutCardProps, LoggedWorkoutPayload, TrackData } from '@/types'
import { TRAINING_LOCATIONS, DEFAULT_FALLBACK_LOCATION } from '@/data/data'
import { HR_ZONES } from '@/utils/constants'
import { HrZoneConfig } from '@/utils/constants'
import { formatShortDate } from '@/utils/date-helpers'
import { getWorkoutIcon, getWorkoutTypeLabel } from '@/utils/workout-helpers'
import { formatPace, paceToSpeed } from '@/utils/formatters'
import { fetchDailyWeather, WeatherData } from '@/lib/weather/open-meteo'
import { getZoneBpmRange } from '@/lib/physiology/heart-rate'
import { getZonePaceRangeFromPam } from '@/lib/physiology/pam'

export function calculateBpmRange(pct: string, maxHr: number): string {
  const [minPct, maxPct] = pct.replace(/%/g, '').split('-').map(Number)
  const minBpm = Math.round((minPct / 100) * maxHr)
  const maxBpm = Math.round((maxPct / 100) * maxHr)
  return `${minBpm} - ${maxBpm} bpm`
}

interface UseWorkoutCardParams {
  workout: WorkoutCardProps['workout']
  maxHr?: number
  restHr?: number
  date?: string
  TrackData?: TrackData | null
  athletePamSec?: number
  isCompleted?: boolean
}

export function useWorkoutCard({
  workout,
  maxHr = 190,
  restHr = 50,
  date,
  TrackData,
  athletePamSec,
  isCompleted: initialIsCompleted = false,
}: UseWorkoutCardParams) {
  const [isLogOpen, setIsLogOpen] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [isLoadingWeather, setIsLoadingWeather] = useState(true)
  const [isLogged, setIsLogged] = useState(initialIsCompleted)

  // Obtenemos dinámicamente el icono y el título
  const headerTitle = getWorkoutTypeLabel(workout.type, workout.title)
  const WorkoutIcon = getWorkoutIcon(workout.type)

  // Etiqueta formateada de la fecha
  const dateLabel = useMemo(() => (date ? formatShortDate(date) : ''), [date])

  // Determinar si la fecha es pasada
  const isPast = useMemo(() => {
    if (!date) return false
    const workoutDay = startOfDay(parseISO(date))
    const today = startOfDay(new Date())
    return isBefore(workoutDay, today)
  }, [date])

  // Resolución de zona con fallback
  const zoneInfo: HrZoneConfig = useMemo(() => {
    return HR_ZONES[workout.zone] ?? HR_ZONES.Z1
  }, [workout.zone])

  // Rango BPM formateado con el Método de Karvonen
  const bpmRange = useMemo(() => {
    const { label } = getZoneBpmRange(workout.zone, { maxHr, restHr })
    return label
  }, [workout.zone, maxHr, restHr])

  // También puedes exponer los límites numéricos si los necesitas para gráficos
  const bpmLimits = useMemo(() => {
    return getZoneBpmRange(workout.zone, { maxHr, restHr })
  }, [workout.zone, maxHr, restHr])

  // Resolución de Coordenadas por Prioridad
  const targetCoordinates = useMemo(() => {
    // Si hay GPX (montaña / carrera / circuito externo), usamos el punto de inicio
    if (TrackData?.startCoordinates) {
      return TrackData.startCoordinates
    }

    // Si el workout define una ubicación específica (pista en La Granja o cuestas en Ullum)
    if (workout.locationKey && TRAINING_LOCATIONS[workout.locationKey]) {
      return TRAINING_LOCATIONS[workout.locationKey]
    }

    // Fallback: Parque de Mayo (calle)
    return DEFAULT_FALLBACK_LOCATION
  }, [TrackData, workout.locationKey])

  // Carga reactiva del clima sin ejecuciones síncronas en cascada (solo si NO es pasado)
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

  // Calculamos los rangos de ritmo, velocidad y tiempo basados en PAM
  const pamRange = useMemo(() => {
    return getZonePaceRangeFromPam(workout.zone, athletePamSec, workout.distance)
  }, [workout.zone, athletePamSec, workout.distance])

  // Valores dinámicos si existe PAM, con fallback a los valores estáticos
  const timeDisplay = pamRange?.timeRangeLabel ?? workout.time
  const paceDisplay = pamRange?.paceRangeLabel ?? formatPace(workout.pace)
  const speedDisplay = pamRange?.speedRangeLabel ?? paceToSpeed(workout.pace)

  //TODO Formateo de estadísticas de la rutina (segun entrenamiento o carrera)
  const stats = useMemo(
    () => [
      {
        icon: Clock,
        label: 'Tiempo est.',
        value: timeDisplay,
        unit: pamRange ? '\nmin' : 'min',
      },
      { icon: Zap, label: 'Ritmo medio', value: paceDisplay, unit: pamRange ? '\nmin/km' : '/km' },
      {
        icon: Gauge,
        label: 'Vel. media',
        value: speedDisplay,
        unit: pamRange ? '\nkm/h' : 'km/h',
      },
    ],
    [timeDisplay, paceDisplay, speedDisplay, pamRange],
  )

  // Determinar si la fecha es futura (posterior a hoy)
  const todayStr = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  // Si `date` es mayor al string de hoy, es un día futuro
  const isFuture = date ? date > todayStr : false

  // Handlers del Modal
  const openLogDialog = () => setIsLogOpen(true)
  const closeLogDialog = () => setIsLogOpen(false)

  const handleSaveSession = (data: LoggedWorkoutPayload) => setIsLogged(true)
  const handleDeleteSession = () => setIsLogged(false)

  return {
    WorkoutIcon,
    headerTitle,
    dateLabel,
    isLogOpen,
    weather,
    isLoadingWeather,
    isPast,
    isFuture,
    isLogged,
    stats,
    zoneInfo,
    bpmRange, // "134 - 148 bpm"
    pamRange,
    minBpm: bpmLimits.minBpm,
    maxBpm: bpmLimits.maxBpm,
    openLogDialog,
    closeLogDialog,
    handleSaveSession,
    handleDeleteSession,
  }
}
