'use client'

import { useState, useEffect, useMemo } from 'react'
import { isBefore, startOfDay, parseISO } from 'date-fns'
import { useTranslations } from 'next-intl'
import { Clock, Zap, Gauge } from 'lucide-react'
import type { ManualRealizedTrainingClientInput, TrackData, WeatherData, WorkoutCardProps } from '@/types'
import { createManualRealizedTrainingAction } from '@/app/actions/realized-training-actions'
import { TRAINING_LOCATIONS, DEFAULT_FALLBACK_LOCATION } from '@/data/data'
import { HR_ZONES } from '@/lib/constants'
import { HrZoneConfig } from '@/lib/constants'
import { formatShortDate } from '@/lib/date-helpers'
import { getWorkoutIcon, getWorkoutTypeLabel } from '@/lib/workout-helpers'
import { formatPace, paceToSpeed } from '@/lib/formatters'
import { fetchDailyWeather } from '@/service/weather/open-meteo'
import { getZoneBpmRange } from '@/lib/physiology/heart-rate'
import { getZonePaceRangeFromPam } from '@/lib/physiology/pam'

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
  const t = useTranslations('Workouts')

  const [isLogOpen, setIsLogOpen] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [isLoadingWeather, setIsLoadingWeather] = useState(true)
  const [isLogged, setIsLogged] = useState(initialIsCompleted)

  const headerTitle = getWorkoutTypeLabel(workout.type, workout.title)
  const WorkoutIcon = getWorkoutIcon(workout.type)

  const dateLabel = useMemo(() => (date ? formatShortDate(date) : ''), [date])

  const isPast = useMemo(() => {
    if (!date) return false
    const workoutDay = startOfDay(parseISO(date))
    const today = startOfDay(new Date())
    return isBefore(workoutDay, today)
  }, [date])

  const zoneInfo: HrZoneConfig = useMemo(() => {
    return HR_ZONES[workout.zone] ?? HR_ZONES.Z1
  }, [workout.zone])

  const bpmRange = useMemo(() => {
    if (!workout?.zone) return ''
    const res = getZoneBpmRange(workout.zone, { maxHr: 190, restHr: 50 })
    return `${res.minBpm}-${res.maxBpm} ${t('dialog.bpm')}`
  }, [workout?.zone, t])

  const bpmLimits = useMemo(() => {
    return getZoneBpmRange(workout.zone, { maxHr, restHr })
  }, [workout.zone, maxHr, restHr])

  const targetCoordinates = useMemo(() => {
    if (TrackData?.startCoordinates) {
      return TrackData.startCoordinates
    }

    if (workout.locationKey && TRAINING_LOCATIONS[workout.locationKey]) {
      return TRAINING_LOCATIONS[workout.locationKey]
    }

    return DEFAULT_FALLBACK_LOCATION
  }, [TrackData, workout.locationKey])

  useEffect(() => {
    let isMounted = true

    const loadWeather = async () => {
      await Promise.resolve()

      if (isPast || !date) {
        if (isMounted) {
          setWeather(null)
          setIsLoadingWeather(false)
        }
        return
      }

      if (isMounted) setIsLoadingWeather(true)

      try {
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

  const pamRange = useMemo(() => {
    return getZonePaceRangeFromPam(workout.zone, athletePamSec, workout.distance)
  }, [workout.zone, athletePamSec, workout.distance])

  const timeDisplay = pamRange?.timeRangeLabel ?? workout.time
  const paceDisplay = pamRange?.paceRangeLabel ?? formatPace(workout.pace)
  const speedDisplay = pamRange?.speedRangeLabel ?? paceToSpeed(workout.pace)

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

  const todayStr = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const isFuture = date ? date > todayStr : false

  const openLogDialog = () => setIsLogOpen(true)
  const closeLogDialog = () => setIsLogOpen(false)

  const handleSaveSession = async (data: ManualRealizedTrainingClientInput) => {
    const result = await createManualRealizedTrainingAction(data)
    if (!result.success) return false
    setIsLogged(true)
    return true
  }

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
    bpmRange,
    pamRange,
    minBpm: bpmLimits.minBpm,
    maxBpm: bpmLimits.maxBpm,
    openLogDialog,
    closeLogDialog,
    handleSaveSession,
    handleDeleteSession,
  }
}
