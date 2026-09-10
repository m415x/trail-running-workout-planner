import { validateRaceDistanceForCategory } from '@/lib/validate-race-distance-for-category'
import type { AthleteCategoryCode } from '@/types/athlete/group.types'
import type { CategoryRaceDistanceResult } from '@/types/athlete/category-race-distance.types'
import type { CompetitionEntry } from '@/types/training/competition-entry.types'

export interface CompetitionEntryWithDistanceCompatibility extends CompetitionEntry {
  /**
   * Advisory result derived from the owning athlete group's category and the
   * competition distance. It is never persisted and never changes ownership,
   * cohort membership, or training load.
   */
  readonly distanceCompatibility: CategoryRaceDistanceResult
}

/**
 * Evaluates one CompetitionEntry against the current category policy.
 * The result is derived at read time so policy changes cannot stale persisted
 * competition data. Category compatibility remains advisory and non-mutating.
 */
export function assessCompetitionDistance(
  categoryCode: AthleteCategoryCode,
  competition: Pick<CompetitionEntry, 'distanceKm'>,
): CategoryRaceDistanceResult {
  return validateRaceDistanceForCategory(categoryCode, competition.distanceKm)
}

/**
 * Adds current distance compatibility to a calendar without persisting it.
 * Athlete level is intentionally excluded because H8 defines category-level
 * competitive distance guidance only.
 */
export function withCompetitionDistanceCompatibility(
  categoryCode: AthleteCategoryCode,
  competitions: readonly CompetitionEntry[],
): CompetitionEntryWithDistanceCompatibility[] {
  return competitions.map((competition) => ({
    ...competition,
    distanceCompatibility: assessCompetitionDistance(categoryCode, competition),
  }))
}
