import { AthleteGroupCode, Session, WorkoutProps } from '@/types'

export function resolveWorkoutForAthlete(session: Session, athleteGroup: AthleteGroupCode): WorkoutProps {
  // 1. Acceso seguro con optional chaining
  const override = session.groupOverrides?.[athleteGroup]

  const km = override?.distanceKm ?? session.defaultVolume.km
  const time = override?.durationMin ?? session.defaultVolume.timeMin
  const pace = time > 0 && km > 0 ? (time * 60) / km : 0

  // 2. Resolución segura de las notas y estructura de la sesión
  let specificNotes = ''

  if (override?.intervals) {
    const baseBlock = override.notes ?? session.structure?.mainBlock ?? session.notes ?? ''
    specificNotes = baseBlock ? `${override.intervals}. ${baseBlock}` : override.intervals
  } else if (session.structure) {
    specificNotes = [session.structure.warmup, session.structure.mainBlock, session.structure.cooldown]
      .filter(Boolean)
      .join(' | ')
  } else {
    specificNotes = session.notes ?? session.title
  }

  return {
    id: Number(session.id) || 1,
    title: session.title,
    distance: km,
    time,
    pace,
    gain: 0,
    zone: session.zone,
    notes: specificNotes,
    trackPath: session.trackPath,
    locationKey: session.locationKey,
  }
}
