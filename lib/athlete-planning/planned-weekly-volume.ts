import { shiftAthletePlanWeek } from './plan-week-navigation'

export interface EffectivePlannedVolumeSession {
  id: string
  date: string
  distanceKm: number | null
  elevationGain: number | null
}

type Metric = { status: 'complete'; value: number } | { status: 'incomplete' | 'unknown'; value: null }
type WeeklyVolume =
  | { status: 'error' }
  | { status: 'empty' | 'loaded'; distance: Metric; elevationGain: Metric }

/**
 * Pure projection over sessions that have already passed SELF authorization,
 * effective Base/Variant selection and individual adjustment resolution.
 * Partial sums are intentionally never exposed as completed totals.
 */
export function projectAthletePlannedWeeklyVolume(
  monday: string,
  effectiveSessions: readonly EffectivePlannedVolumeSession[],
): WeeklyVolume {
  let nextMonday: string
  try {
    nextMonday = shiftAthletePlanWeek(monday, 1)
  } catch {
    return { status: 'error' }
  }

  const unique = new Map<string, EffectivePlannedVolumeSession>()
  for (const session of effectiveSessions) {
    const previous = unique.get(session.id)
    if (previous) {
      if (
        previous.date !== session.date
        || previous.distanceKm !== session.distanceKm
        || previous.elevationGain !== session.elevationGain
      ) return { status: 'error' }
      continue
    }
    unique.set(session.id, session)
  }

  const inWeek = [...unique.values()].filter(
    session => session.date >= monday && session.date < nextMonday,
  )
  if (inWeek.length === 0) {
    return {
      status: 'empty',
      distance: { status: 'unknown', value: null },
      elevationGain: { status: 'unknown', value: null },
    }
  }

  const aggregate = (key: 'distanceKm' | 'elevationGain'): Metric => {
    if (inWeek.some(session => session[key] === null || !Number.isFinite(session[key]))) {
      return { status: 'incomplete', value: null }
    }
    return {
      status: 'complete',
      value: inWeek.reduce((total, session) => total + (session[key] ?? 0), 0),
    }
  }

  return { status: 'loaded', distance: aggregate('distanceKm'), elevationGain: aggregate('elevationGain') }
}
