'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

import type {
  IntensityZone,
  RealizedTrainingRecord,
  TrackData,
  WeekDay,
  WeeklyCycle,
  WorkoutType,
} from '@/types'
import type { CurrentAthleteData } from '@/app/actions/dashboard-actions'
import type { ElevationChartProps } from '@workouts/components/ElevationProfileCard'

import { parseISODate } from '@/lib/date-helpers'
import { getCurrentISODateInTimeZone } from '@/lib/date-time/current-calendar-date'
import {
  hasUnplannedTrainingOnDate,
  reconcileTrainingDayStatus,
  type PlannedSessionEvidenceOutcome,
} from '@/lib/realized-training/day-status-reconciliation'
import { parseTrackFromUrl } from '@/lib/tracks/track-parser'

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

interface SessionWorkout {
  id: string
  title: string
  type: WorkoutType
  distance: number | null
  time: number | null
  gain: number | null
  pace: number | null
  zone: IntensityZone | null
  notes?: string | null
  trackPath?: string | null
  locationKey?: string | null
}

export interface SessionWithWorkout {
  id: string
  teamId: string
  date: string
  title: string
  workoutId?: string | null
  workout?: SessionWorkout | null
  location?: { name: string } | null
  structure?: {
    preliminaryExercises?: string | null
    warmup?: string | null
    mainBlock?: string | null
    cooldown?: string | null
  } | null
  sessionPrescriptions: Array<{
    distanceKm: number | null
    durationMin: number | null
    elevationGain: number | null
    intensityMethod: 'hr_zone' | 'reference_percentage' | null
    zone: IntensityZone | null
    referencePercentage: number | null
    notes: string | null
  }>
  locationKey?: string | null
  trackPath?: string | null
  notes?: string | null
  type: WorkoutType
}

export interface UseHomeTabProps {
  initialSchedule: SessionWithWorkout[]
  initialRealizedTraining: RealizedTrainingRecord[]
  initialAthlete: CurrentAthleteData
  locale: string
  onWeekChange: (startDateIso: string) => Promise<SessionWithWorkout[]>
  onRealizedTrainingWeekChange: (startDateIso: string, endDateIso: string) => Promise<RealizedTrainingRecord[]>
}

function formatLocalISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonday(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  const difference = result.getDate() - day + (day === 0 ? -6 : 1)
  result.setDate(difference)
  result.setHours(0, 0, 0, 0)
  return result
}

function shiftDate(date: Date, days: number): Date {
  const shifted = new Date(date)
  shifted.setDate(shifted.getDate() + days)
  return shifted
}

/** Builds the athlete view from the prescription assigned to their group. */
function resolveGroupWorkout(session: SessionWithWorkout) {
  const prescription = session.sessionPrescriptions[0]
  if (!prescription) return null

  const instructionBlocks = [
    prescription.notes,
    session.structure?.preliminaryExercises,
    session.structure?.warmup,
    session.structure?.mainBlock,
    session.structure?.cooldown,
    session.notes !== prescription.notes ? session.notes : null,
  ].filter(Boolean)
  const distance = prescription.distanceKm ?? 0
  const time = prescription.durationMin ?? 0

  return {
    id: session.id,
    title: session.title,
    type: session.type,
    distance,
    zone: prescription.zone ?? session.workout?.zone ?? ('Z1' as IntensityZone),
    intensity: prescription.intensityMethod === 'reference_percentage' && prescription.referencePercentage != null
      ? { method: 'reference_percentage' as const, referencePercentage: prescription.referencePercentage }
      : prescription.zone
        ? { method: 'hr_zone' as const, zone: prescription.zone }
        : undefined,
    time,
    gain: prescription.elevationGain ?? 0,
    pace: time > 0 && distance > 0 ? (time * 60) / distance : 0,
    notes: instructionBlocks.join(' | '),
    trackPath: session.trackPath ?? session.workout?.trackPath ?? undefined,
    locationKey: session.locationKey ?? session.workout?.locationKey ?? undefined,
  }
}

/**
 * Returns the best currently-known compliance outcome for sessions on one day.
 * A realized row does not imply completion by itself: only explicit
 * `completed`/`partial` outcomes are consumed here. The future plan-vs-realized
 * evaluator remains responsible for deciding between those two states.
 */
function resolveMatchedEvidenceOutcome(
  daySessions: readonly SessionWithWorkout[],
  records: readonly RealizedTrainingRecord[],
): PlannedSessionEvidenceOutcome {
  const sessionIds = new Set(daySessions.map(session => session.id))
  const linked = records.filter(record => record.sessionId !== null && sessionIds.has(record.sessionId))

  if (linked.some(record => record.status === 'completed')) return 'completed'
  if (linked.some(record => record.status === 'partial')) return 'partial'
  return null
}

export function useHomeTab({
  initialSchedule,
  initialRealizedTraining,
  initialAthlete,
  locale,
  onWeekChange,
  onRealizedTrainingWeekChange,
}: UseHomeTabProps) {
  const tPlanning = useTranslations('BasePlanning')
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [schedule, setSchedule] = useState<SessionWithWorkout[]>(initialSchedule)
  const [realizedTraining, setRealizedTraining] = useState<RealizedTrainingRecord[]>(initialRealizedTraining)
  const [isLoadingWeek, setIsLoadingWeek] = useState(false)
  const [trackData, setTrackData] = useState<TrackData | null>(null)

  const athleteGroup = initialAthlete.athleteProfile.group ?? null
  const startOfWeek = useMemo(() => getMonday(selectedDate), [selectedDate])

  /**
   * Weekly calendar state is reconciled from two independent sources:
   * prescribed sessions and durable realized-training evidence. Rest-day
   * training remains unplanned evidence and is never attached to a session.
   */
  const weekDays = useMemo<WeekDay[]>(() => {
    const todayISO = getCurrentISODateInTimeZone()

    return Array.from({ length: 7 }, (_, index) => {
      const currentDate = shiftDate(startOfWeek, index)
      const isoDate = formatLocalISODate(currentDate)
      const daySessions = schedule.filter(candidate => candidate.date === isoDate)
      const session = daySessions[0]
      const hasUnplannedTraining = hasUnplannedTrainingOnDate(realizedTraining, isoDate)

      const baseDay = {
        date: isoDate,
        fullDate: isoDate,
        day: DAY_LETTERS[index],
        dayName: currentDate.toLocaleDateString(locale, { weekday: 'short' }),
        dayNumber: currentDate.getDate(),
        isToday: isoDate === todayISO,
        hasUnplannedTraining,
      }

      if (!session || !athleteGroup) {
        return {
          ...baseDay,
          type: 'Rest',
          isRest: true,
          status: 'rest',
        } as WeekDay
      }

      const resolvedWorkout = resolveGroupWorkout(session)
      if (!resolvedWorkout || resolvedWorkout.type === 'Rest') {
        return {
          ...baseDay,
          type: 'Rest',
          isRest: true,
          status: 'rest',
        } as WeekDay
      }

      const status = reconcileTrainingDayStatus({
        date: isoDate,
        today: todayISO,
        hasPlannedSession: true,
        matchedEvidenceOutcome: resolveMatchedEvidenceOutcome(daySessions, realizedTraining),
      })

      return {
        ...baseDay,
        type: resolvedWorkout.type,
        isRest: false,
        status,
        workoutId: session.workoutId ? Number(session.workoutId) : undefined,
        km: daySessions.reduce(
          (total, candidate) => total + (candidate.sessionPrescriptions[0]?.distanceKm ?? 0),
          0,
        ),
      } as WeekDay
    })
  }, [athleteGroup, locale, realizedTraining, schedule, startOfWeek])

  const selectedDay = useMemo(() => {
    const selectedISODate = formatLocalISODate(selectedDate)
    const index = weekDays.findIndex(day => day.fullDate === selectedISODate)
    return index >= 0 ? index : 0
  }, [selectedDate, weekDays])

  const selectedWeekDay = weekDays[selectedDay]

  const weeklyCycle = useMemo<WeeklyCycle>(() => {
    const mondayISO = weekDays[0]?.fullDate ?? ''
    const sundayISO = weekDays[6]?.fullDate ?? ''
    const targetKm = schedule.reduce(
      (total, session) => total + (session.sessionPrescriptions[0]?.distanceKm ?? 0),
      0,
    )
    const rangeFormatter = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
    const title = mondayISO && sundayISO
      ? `${rangeFormatter.format(parseISODate(mondayISO))}–${rangeFormatter.format(parseISODate(sundayISO))}`
      : ''

    return {
      id: 'current',
      title,
      phase: tPlanning('intents.development'),
      startDate: mondayISO,
      endDate: sundayISO,
      targetKm,
    }
  }, [locale, schedule, tPlanning, weekDays])

  const currentWorkouts = useMemo(() => {
    if (!selectedWeekDay || !athleteGroup) return []

    return schedule
      .filter(candidate => candidate.date === selectedWeekDay.fullDate)
      .map(resolveGroupWorkout)
      .filter((workout): workout is NonNullable<typeof workout> => workout !== null)
  }, [athleteGroup, schedule, selectedWeekDay])

  const currentWorkout = currentWorkouts[0] ?? null

  useEffect(() => {
    let isMounted = true

    async function loadTrack() {
      if (!currentWorkout?.trackPath) {
        if (isMounted) setTrackData(null)
        return
      }

      try {
        const parsedTrack = await parseTrackFromUrl(currentWorkout.trackPath)
        if (isMounted) setTrackData(parsedTrack)
      } catch (error) {
        console.error('Could not load workout track:', error)
        if (isMounted) setTrackData(null)
      }
    }

    void loadTrack()
    return () => {
      isMounted = false
    }
  }, [currentWorkout?.trackPath])

  const elevationChartData = useMemo<ElevationChartProps | null>(() => {
    if (!currentWorkout || !trackData || trackData.elevationProfile.length === 0) return null

    const elevations = trackData.elevationProfile.map((point: { elev: number }) => point.elev)
    const elevationMin = Math.min(...elevations)
    const elevationMax = Math.max(...elevations)

    return {
      workout: {
        ...currentWorkout,
        km: trackData.distanceKm || currentWorkout.distance,
        gain: trackData.gainMeters || currentWorkout.gain,
      },
      elevData: trackData.elevationProfile,
      elevMin: elevationMin,
      elevMax: elevationMax,
      yDomain: [Math.floor(elevationMin - 30), Math.ceil(elevationMax + 30)],
    }
  }, [currentWorkout, trackData])

  const loadWeek = useCallback(
    async (nextDate: Date) => {
      setSelectedDate(nextDate)
      setIsLoadingWeek(true)

      try {
        const monday = getMonday(nextDate)
        const sunday = shiftDate(monday, 6)
        const startDateIso = formatLocalISODate(monday)
        const endDateIso = formatLocalISODate(sunday)
        const [newSchedule, newRealizedTraining] = await Promise.all([
          onWeekChange(startDateIso),
          onRealizedTrainingWeekChange(startDateIso, endDateIso),
        ])

        setSchedule(newSchedule)
        setRealizedTraining(newRealizedTraining)
      } catch (error) {
        console.error('Could not load training week:', error)
      } finally {
        setIsLoadingWeek(false)
      }
    },
    [onRealizedTrainingWeekChange, onWeekChange],
  )

  const handlePrevWeek = useCallback(async () => {
    await loadWeek(shiftDate(startOfWeek, -7))
  }, [loadWeek, startOfWeek])

  const handleNextWeek = useCallback(async () => {
    await loadWeek(shiftDate(startOfWeek, 7))
  }, [loadWeek, startOfWeek])

  const handleSelectDay = useCallback(
    (index: number) => {
      const targetDay = weekDays[index]
      if (!targetDay?.fullDate) return
      setSelectedDate(parseISODate(targetDay.fullDate))
    },
    [weekDays],
  )

  const handleSelectDate = useCallback(
    async (date: Date | undefined) => {
      if (date) await loadWeek(date)
    },
    [loadWeek],
  )

  const handleRealizedTrainingSaved = useCallback((record: RealizedTrainingRecord) => {
    setRealizedTraining(current => [record, ...current.filter(candidate => candidate.id !== record.id)])
  }, [])

  return {
    team: initialAthlete.athleteProfile.team,
    user: initialAthlete,
    athlete: initialAthlete.athleteProfile,
    athleteGroup,
    weeklyCycle,
    weekDays,
    selectedDay,
    selectedDate,
    selectedWeekDay,
    currentWorkout,
    currentWorkouts,
    elevationChartData,
    TrackData: trackData,
    isLoadingWeek,
    onSelectDay: handleSelectDay,
    onPrevWeek: handlePrevWeek,
    onNextWeek: handleNextWeek,
    onSelectDate: handleSelectDate,
    onRealizedTrainingSaved: handleRealizedTrainingSaved,
  }
}
