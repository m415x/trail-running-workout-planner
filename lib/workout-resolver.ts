import type { AthleteGroupCode } from '@/types/athlete/group.types'
import type { IntensityZone } from '@/types/training/intensity.types'
import type { WorkoutProps, WorkoutType } from '@/types/training/workout.types'

interface ResolvableSession {
  id: string
  title: string
  type: WorkoutType
  zone: IntensityZone
  defaultVolume: {
    km: number
    timeMin: number
  }
  groupOverrides?: Partial<
    Record<
      AthleteGroupCode,
      {
        distanceKm: number
        durationMin?: number
      }
    >
  >
  trackPath?: string | null
  locationKey?: string | null
}

export function resolveWorkoutForAthlete(session: ResolvableSession, athleteGroup: AthleteGroupCode): WorkoutProps {
  // 1. Acceso seguro con optional chaining
  const override = session.groupOverrides?.[athleteGroup]

  const km = override?.distanceKm ?? session.defaultVolume.km
  const time = override?.durationMin ?? session.defaultVolume.timeMin
  const pace = time > 0 && km > 0 ? (time * 60) / km : 0

  // 2. Resolución segura de las notas y estructura de la sesión
  const specificNotes = ''

  // if (override?.intervals) {
  //   const baseBlock = override.notes ?? session.structure?.mainBlock ?? session.notes ?? ''
  //   specificNotes = baseBlock ? `${override.intervals}. ${baseBlock}` : override.intervals
  // } else if (session.structure) {
  //   specificNotes = [session.structure.warmup, session.structure.mainBlock, session.structure.cooldown]
  //     .filter(Boolean)
  //     .join(' | ')
  // } else {
  //   specificNotes = session.notes ?? session.title
  // }

  return {
    id: Number(session.id) || 1,
    title: session.title,
    type: session.type,
    distance: km,
    zone: session.zone,
    time,
    gain: 0,
    pace,
    notes: specificNotes,
    trackPath: session.trackPath ?? undefined,
    locationKey: session.locationKey ?? undefined,
  }
}
