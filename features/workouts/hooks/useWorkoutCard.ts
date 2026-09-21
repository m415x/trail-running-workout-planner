'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Clock, Zap, Gauge } from 'lucide-react'
import type {
  ManualRealizedTrainingClientInput,
  RealizedTrainingRecord,
  TrackData,
  WeatherData,
  WorkoutCardProps,
} from '@/types'
import {
  correctManualRealizedTrainingAction,
  createManualRealizedTrainingAction,
  getManualRealizedSessionStateAction,
} from '@/app/actions/realized-training-actions'
import { TRAINING_LOCATIONS, DEFAULT_FALLBACK_LOCATION } from '@/data/data'
import { HR_ZONES } from '@/lib/constants'
import { HrZoneConfig } from '@/lib/constants'
import { formatShortDate } from '@/lib/date-helpers'
import { getCurrentISODateInTimeZone } from '@/lib/date-time/current-calendar-date'
import { getWorkoutIcon, getWorkoutTypeLabel } from '@/lib/workout-helpers'
import { formatPace, paceToSpeed } from '@/lib/formatters'
import { fetchDailyWeather } from '@/service/weather/open-meteo'
import { resolveExecutionGuidance } from '@/lib/physiology/execution-guidance'

interface UseWorkoutCardParams {
  workout: WorkoutCardProps['workout']
  date?: string
  TrackData?: TrackData | null
  isCompleted?: boolean
  onRealizedTrainingSaved?: (record: RealizedTrainingRecord) => void
}

interface DurableCaptureState {
  readonly sessionId: string
  readonly captured: boolean
  readonly workoutLogId: string | null
  readonly editableInput: ManualRealizedTrainingClientInput | null
}

export function useWorkoutCard({
  workout,
  date,
  TrackData,
  isCompleted: initialIsCompleted = false,
  onRealizedTrainingSaved,
}: UseWorkoutCardParams) {
  const t = useTranslations('Workouts')

  const [isLogOpen, setIsLogOpen] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [isLoadingWeather, setIsLoadingWeather] = useState(true)
  const sessionId = String(workout.id)
  const [captureState, setCaptureState] = useState<DurableCaptureState | null>(null)
  const isCaptureReady = captureState?.sessionId === sessionId
  const isLogged = isCaptureReady ? captureState.captured : initialIsCompleted
  const canEditLoggedWorkout = Boolean(
    isCaptureReady && captureState?.captured && captureState.workoutLogId && captureState.editableInput,
  )

  useEffect(() => {
    let active = true
    getManualRealizedSessionStateAction(sessionId).then(result => {
      if (active && result.success) {
        setCaptureState({
          sessionId,
          captured: result.captured,
          workoutLogId: result.workoutLogId,
          editableInput: result.editableInput,
        })
      }
    }).catch(() => {
      // Keep capture disabled when persisted state cannot be verified.
    })
    return () => { active = false }
  }, [sessionId])

  const headerTitle = getWorkoutTypeLabel(workout.type, workout.title)
  const WorkoutIcon = getWorkoutIcon(workout.type)
  const dateLabel = useMemo(() => (date ? formatShortDate(date) : ''), [date])
  const todayStr = useMemo(() => getCurrentISODateInTimeZone(), [])
  const isPast = Boolean(date && date < todayStr)
  const isFuture = Boolean(date && date > todayStr)

  const zoneInfo: HrZoneConfig = useMemo(() => {
    return HR_ZONES[workout.zone] ?? HR_ZONES.Z1
  }, [workout.zone])

  // HR guidance remains unavailable until explicit athlete evidence reaches this boundary.
  const bpmRange = ''
  const executionGuidance = useMemo(() => resolveExecutionGuidance({
    intensity: workout.intensity ?? { method: 'hr_zone', zone: workout.zone },
    runningReference: workout.runningReference ?? { status: 'unknown' },
  }), [workout.intensity, workout.runningReference, workout.zone])

  const targetCoordinates = useMemo(() => {
    if (TrackData?.startCoordinates) return TrackData.startCoordinates
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
        console.error('Error loading workout weather:', error)
      } finally {
        if (isMounted) setIsLoadingWeather(false)
      }
    }

    loadWeather()
    return () => {
      isMounted = false
    }
  }, [date, isPast, targetCoordinates.lat, targetCoordinates.lon])

  const timeDisplay = workout.time
  const paceDisplay = formatPace(workout.pace)
  const speedDisplay = paceToSpeed(workout.pace)

  const stats = useMemo(
    () => [
      {
        icon: Clock,
        label: t('card.estimatedTime'),
        value: timeDisplay,
        unit: 'min',
      },
      { icon: Zap, label: t('card.avgPace'), value: paceDisplay, unit: '/km' },
      {
        icon: Gauge,
        label: t('card.avgSpeed'),
        value: speedDisplay,
        unit: 'km/h',
      },
    ],
    [timeDisplay, paceDisplay, speedDisplay, t],
  )

  const openLogDialog = () => setIsLogOpen(true)
  const closeLogDialog = () => setIsLogOpen(false)

  /** Creates the first durable capture or appends a traced correction to it. */
  const handleSaveSession = async (data: ManualRealizedTrainingClientInput) => {
    if (captureState?.captured && captureState.workoutLogId && captureState.editableInput) {
      const result = await correctManualRealizedTrainingAction({
        workoutLogId: captureState.workoutLogId,
        reason: null,
        replacement: data,
      })
      if (!result.success) return false
      setCaptureState({
        sessionId,
        captured: true,
        workoutLogId: captureState.workoutLogId,
        editableInput: data,
      })
      onRealizedTrainingSaved?.(result.data)
      return true
    }

    const result = await createManualRealizedTrainingAction(data)
    if (!result.success) return false
    setCaptureState({
      sessionId,
      captured: true,
      workoutLogId: result.data.id,
      editableInput: data,
    })
    onRealizedTrainingSaved?.(result.data)
    return true
  }

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
    isCaptureReady,
    canEditLoggedWorkout,
    editableCaptureInput: captureState?.editableInput ?? null,
    stats,
    zoneInfo,
    bpmRange,
    executionGuidance,
    openLogDialog,
    closeLogDialog,
    handleSaveSession,
  }
}
