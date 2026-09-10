import { validateRaceDistanceForCategory } from '@/lib/validate-race-distance-for-category'
import type { AthleteGroupCode } from '@/types/athlete/group.types'
import type { TargetRaceSnapshot } from '@/types/training/periodization.types'

/** Evaluate a generated plan's race snapshot, using its sporting group code. */
export function assessPlanningRaceDistance(
  groupCode: AthleteGroupCode,
  race: Pick<TargetRaceSnapshot, 'distanceKm'> | null | undefined,
) {
  const category = typeof groupCode === 'string' && /^[EUMHSB][123]$/.test(groupCode)
    ? groupCode[0]
    : undefined
  return validateRaceDistanceForCategory(category, race?.distanceKm)
}

/**
 * Enrich persisted macrocycles with current advisory policy results, without
 * writing or changing snapshots. The parent plan's group supplies the category
 * for both base plans and cohort variants. No weekly load enters evaluation.
 */
export function withPlanningRaceDistance<T extends { targetRaceDistanceKm?: number | null }>(
  categoryCode: unknown,
  macrocycles: readonly T[],
) {
  return macrocycles.map((macrocycle) => ({
    ...macrocycle,
    raceDistanceCompatibility: validateRaceDistanceForCategory(categoryCode, macrocycle.targetRaceDistanceKm),
  }))
}
