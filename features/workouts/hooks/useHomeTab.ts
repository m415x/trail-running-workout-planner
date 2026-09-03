'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import type {
  AthleteGroup,
  AthleteProfile,
  IntensityZone,
  Team,
  TrackData,
  User,
  WeekDay,
  WeeklyCycle,
  WorkoutType,
} from '@/types'

import type { ElevationChartProps } from '@workouts/components/ElevationProfileCard'

import { parseISODate } from '@/lib/date-helpers'
import { parseTrackFromUrl } from '@/lib/tracks/track-parser'

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

interface SessionWorkout {
  id: string
  title: string
  type: WorkoutType

  distance: number
  time: number
  gain: number
  pace: number | null

  zone: IntensityZone

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
    intensityMethod: 'hr_zone' | 'pam_percentage' | null
    zone: IntensityZone | null
    pamPercentage: number | null
    notes: string | null
  }>

  locationKey?: string | null
  trackPath?: string | null
  notes?: string | null

  type: WorkoutType
}

export interface AthleteProfileWithDashboardRelations extends AthleteProfile {
  team?: Team
  group?: AthleteGroup | null
}

interface UseHomeTabProps {
  initialSchedule: SessionWithWorkout[]

  initialAthlete: User & {
    athleteProfile: AthleteProfileWithDashboardRelations
  }

  onWeekChange: (startDateIso: string) => Promise<SessionWithWorkout[]>
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

/** Construye la vista del atleta desde la prescripción de su grupo. */
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
    time,
    gain: prescription.elevationGain ?? 0,
    pace: time > 0 && distance > 0 ? (time * 60) / distance : 0,
    notes: instructionBlocks.join(' | '),
    trackPath: session.trackPath ?? session.workout?.trackPath ?? undefined,
    locationKey: session.locationKey ?? session.workout?.locationKey ?? undefined,
  }
}

export function useHomeTab({ initialSchedule, initialAthlete, onWeekChange }: UseHomeTabProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())

  const [schedule, setSchedule] = useState<SessionWithWorkout[]>(initialSchedule)

  const [isLoadingWeek, setIsLoadingWeek] = useState(false)

  const [trackData, setTrackData] = useState<TrackData | null>(null)

  // -----------------------------------------------------------------------
  // Grupo actual del atleta
  // -----------------------------------------------------------------------

  const athleteGroup = initialAthlete.athleteProfile.group ?? null


  // -----------------------------------------------------------------------
  // Inicio de la semana seleccionada
  // -----------------------------------------------------------------------

  const startOfWeek = useMemo(() => getMonday(selectedDate), [selectedDate])

  // -----------------------------------------------------------------------
  // Días de la semana
  // -----------------------------------------------------------------------

  const weekDays = useMemo<WeekDay[]>(() => {
    const todayISO = formatLocalISODate(new Date())

    return Array.from({ length: 7 }, (_, index) => {
      const currentDate = new Date(startOfWeek)

      currentDate.setDate(startOfWeek.getDate() + index)

      const isoDate = formatLocalISODate(currentDate)

      const daySessions = schedule.filter((candidate) => candidate.date === isoDate)
      const session = daySessions[0]

      const baseDay = {
        date: isoDate,
        fullDate: isoDate,

        day: DAY_LETTERS[index],

        dayName: currentDate.toLocaleDateString('es-ES', {
          weekday: 'short',
        }),

        dayNumber: currentDate.getDate(),
        isToday: isoDate === todayISO,
      }

      /*
       * Si no hay una sesión para la fecha o el atleta todavía
       * no tiene grupo, mostramos el día como descanso.
       */
      if (!session || !athleteGroup) {
        return {
          ...baseDay,

          type: 'Rest',
          isRest: true,
        } as WeekDay
      }

      const resolvedWorkout = resolveGroupWorkout(session)

      if (!resolvedWorkout) return { ...baseDay, type: 'Rest', isRest: true } as WeekDay

      return {
        ...baseDay,

        type: resolvedWorkout.type,

        isRest: resolvedWorkout.type === 'Rest',

        workoutId: session.workoutId ? Number(session.workoutId) : undefined,

        km: daySessions.reduce(
          (total, candidate) => total + (candidate.sessionPrescriptions[0]?.distanceKm ?? 0),
          0,
        ),
      } as WeekDay
    })
  }, [athleteGroup, schedule, startOfWeek])

  // -----------------------------------------------------------------------
  // Día actualmente seleccionado
  // -----------------------------------------------------------------------

  const selectedDay = useMemo(() => {
    const selectedISODate = formatLocalISODate(selectedDate)

    const index = weekDays.findIndex((day) => day.fullDate === selectedISODate)

    return index >= 0 ? index : 0
  }, [selectedDate, weekDays])

  const selectedWeekDay = weekDays[selectedDay]

  // -----------------------------------------------------------------------
  // Microciclo semanal utilizado por la UI
  // -----------------------------------------------------------------------

  const weeklyCycle = useMemo<WeeklyCycle>(() => {
    const mondayISO = weekDays[0]?.fullDate ?? ''

    const sundayISO = weekDays[6]?.fullDate ?? ''

    const targetKm = schedule.reduce(
      (total, session) => total + (session.sessionPrescriptions[0]?.distanceKm ?? 0),
      0,
    )

    return {
      id: 'current',

      title: `Semana del ${mondayISO}`,
      phase: 'Desarrollo',

      startDate: mondayISO,
      endDate: sundayISO,

      targetKm,
    }
  }, [schedule, weekDays])

  // -----------------------------------------------------------------------
  // Workout del día seleccionado
  // -----------------------------------------------------------------------

  const currentWorkouts = useMemo(() => {
    if (!selectedWeekDay || !athleteGroup) return []

    return schedule
      .filter((candidate) => candidate.date === selectedWeekDay.fullDate)
      .map(resolveGroupWorkout)
      .filter((workout): workout is NonNullable<typeof workout> => workout !== null)
  }, [athleteGroup, schedule, selectedWeekDay])

  const currentWorkout = currentWorkouts[0] ?? null

  // -----------------------------------------------------------------------
  // Carga del archivo GPX
  // -----------------------------------------------------------------------

  useEffect(() => {
    let isMounted = true

    async function loadTrack() {
      if (!currentWorkout?.trackPath) {
        if (isMounted) {
          setTrackData(null)
        }

        return
      }

      try {
        const parsedTrack = await parseTrackFromUrl(currentWorkout.trackPath)

        if (isMounted) {
          setTrackData(parsedTrack)
        }
      } catch (error) {
        console.error('No se pudo cargar el track:', error)

        if (isMounted) {
          setTrackData(null)
        }
      }
    }

    void loadTrack()

    return () => {
      isMounted = false
    }
  }, [currentWorkout?.trackPath])

  // -----------------------------------------------------------------------
  // Información de altimetría
  // -----------------------------------------------------------------------

  const elevationChartData = useMemo<ElevationChartProps | null>(() => {
    if (!currentWorkout || !trackData || trackData.elevationProfile.length === 0) {
      return null
    }

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

  // -----------------------------------------------------------------------
  // Navegación entre semanas
  // -----------------------------------------------------------------------

  const loadWeek = useCallback(
    async (nextDate: Date) => {
      setSelectedDate(nextDate)
      setIsLoadingWeek(true)

      try {
        const monday = getMonday(nextDate)

        const newSchedule = await onWeekChange(formatLocalISODate(monday))

        setSchedule(newSchedule)
      } catch (error) {
        console.error('No se pudo cargar la semana:', error)
      } finally {
        setIsLoadingWeek(false)
      }
    },
    [onWeekChange],
  )

  const handlePrevWeek = useCallback(async () => {
    const previousWeek = new Date(startOfWeek)

    previousWeek.setDate(startOfWeek.getDate() - 7)

    await loadWeek(previousWeek)
  }, [loadWeek, startOfWeek])

  const handleNextWeek = useCallback(async () => {
    const nextWeek = new Date(startOfWeek)

    nextWeek.setDate(startOfWeek.getDate() + 7)

    await loadWeek(nextWeek)
  }, [loadWeek, startOfWeek])

  // -----------------------------------------------------------------------
  // Selección de día/fecha
  // -----------------------------------------------------------------------

  const handleSelectDay = useCallback(
    (index: number) => {
      const targetDay = weekDays[index]

      if (!targetDay?.fullDate) {
        return
      }

      setSelectedDate(parseISODate(targetDay.fullDate))
    },
    [weekDays],
  )

  const handleSelectDate = useCallback((date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
    }
  }, [])

  // -----------------------------------------------------------------------
  // API pública del hook
  // -----------------------------------------------------------------------

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
  }
}
