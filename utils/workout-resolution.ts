import { AthleteGroupCode } from '@/types/athlete-groups.types'
import { DailyWorkoutSession } from '@/types/workout-session.types'
import { WorkoutProps } from '@/features/workouts/types/workout.types'

export function resolveWorkoutForAthlete(session: DailyWorkoutSession, athleteGroup: AthleteGroupCode): WorkoutProps {
  const override = session.groupOverrides[athleteGroup]

  const km = override?.km ?? session.defaultVolume.km
  const time = override?.timeMin ?? session.defaultVolume.timeMin
  const pace = time > 0 && km > 0 ? (time * 60) / km : 0

  const specificNotes = override?.intervals
    ? `${override.intervals}. ${override.notes ?? session.structure.mainBlock}`
    : `${session.structure.warmup} | ${session.structure.mainBlock} | ${session.structure.cooldown}`

  return {
    id: Number(session.id) || 1,
    title: session.title,
    km,
    time,
    pace,
    gain: 0,
    zone: session.intensityZone,
    notes: specificNotes,
    gpxPath: session.gpxPath,
    locationKey: session.locationKey,
  }
}
