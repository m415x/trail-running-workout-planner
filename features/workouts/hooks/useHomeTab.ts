'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import type {
  AthleteGroup,
  AthleteGroupCode,
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

import { buildAthleteGroupCode } from '@/lib/athlete-group-helpers'
import { parseISODate } from '@/lib/date-helpers'
import { parseTrackFromUrl } from '@/lib/tracks/track-parser'
import { resolveWorkoutForAthlete } from '@/lib/workout-resolver'

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

  locationKey?: string | null
  trackPath?: string | null
  notes?: string | null

  /*
   * Estos campos mantienen compatibilidad temporal con
   * resolveWorkoutForAthlete(), que todavía trabaja con el
   * modelo anterior de Session.
   *
   * Cuando el dashboard consulte GroupSessionPrescription,
   * esta adaptación podrá eliminarse.
   */
  type?: WorkoutType
  zone?: IntensityZone

  defaultVolume?: {
    km: number
    timeMin: number
  }

  groupOverrides?: Partial<
    Record<
      AthleteGroupCode,
      {
        distanceKm: number
        durationMin?: number
        notes?: string
      }
    >
  >
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

/**
 * Adaptación temporal entre el modelo nuevo de Session/Workout
 * y el resolver antiguo.
 *
 * Cuando resolveWorkoutForAthlete trabaje directamente con
 * GroupSessionPrescription, esta función ya no será necesaria.
 */
function adaptSessionForLegacyResolver(session: SessionWithWorkout) {
  const workout = session.workout

  const zone: IntensityZone = session.zone ?? workout?.zone ?? 'Z2'

  return {
    id: session.id,
    microcycleId: '',

    date: session.date,
    title: session.title,

    type: session.type ?? workout?.type ?? ('Base' as WorkoutType),

    zone,

    locationKey: session.locationKey ?? workout?.locationKey ?? undefined,

    trackPath: session.trackPath ?? workout?.trackPath ?? undefined,

    defaultVolume: session.defaultVolume ?? {
      km: workout?.distance ?? 0,
      timeMin: workout?.time ?? 0,
    },

    groupOverrides: session.groupOverrides,

    notes: session.notes ?? workout?.notes ?? undefined,
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

  const athleteGroupCode = useMemo<AthleteGroupCode | null>(() => {
    if (!athleteGroup) {
      return null
    }

    return buildAthleteGroupCode(athleteGroup)
  }, [athleteGroup])

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

      const session = schedule.find((candidate) => candidate.date === isoDate)

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
      if (!session || !athleteGroupCode) {
        return {
          ...baseDay,

          type: 'Rest',
          isRest: true,
        } as WeekDay
      }

      const legacySession = adaptSessionForLegacyResolver(session)

      const resolvedWorkout = resolveWorkoutForAthlete(legacySession, athleteGroupCode)

      return {
        ...baseDay,

        type: resolvedWorkout.type,

        isRest: resolvedWorkout.type === 'Rest',

        workoutId: session.workoutId ? Number(session.workoutId) : undefined,

        km: resolvedWorkout.distance,
      } as WeekDay
    })
  }, [athleteGroupCode, schedule, startOfWeek])

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

    const targetKm = weekDays.reduce((total, day) => total + Number(day.km ?? 0), 0)

    return {
      id: 'current',

      title: `Semana del ${mondayISO}`,
      phase: 'Desarrollo',

      startDate: mondayISO,
      endDate: sundayISO,

      targetKm,
    }
  }, [weekDays])

  // -----------------------------------------------------------------------
  // Workout del día seleccionado
  // -----------------------------------------------------------------------

  const currentWorkout = useMemo(() => {
    if (!selectedWeekDay || !athleteGroupCode) {
      return null
    }

    const session = schedule.find((candidate) => candidate.date === selectedWeekDay.fullDate)

    if (!session) {
      return null
    }

    const legacySession = adaptSessionForLegacyResolver(session)

    return resolveWorkoutForAthlete(legacySession, athleteGroupCode)
  }, [athleteGroupCode, schedule, selectedWeekDay])

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
    athleteGroupCode,

    weeklyCycle,
    weekDays,

    selectedDay,
    selectedDate,
    selectedWeekDay,

    currentWorkout,
    elevationChartData,

    TrackData: trackData,

    isLoadingWeek,

    onSelectDay: handleSelectDay,
    onPrevWeek: handlePrevWeek,
    onNextWeek: handleNextWeek,
    onSelectDate: handleSelectDate,
  }
}
