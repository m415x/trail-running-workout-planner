import {
  resolveAthletePlanningOnDate,
  type AthletePlanningResolution,
} from '@/lib/planning-cohorts/planning-resolution'

type DatedPlanningInput = Parameters<typeof resolveAthletePlanningOnDate>[0]
export type PlanningRangeResolutionInput = Omit<DatedPlanningInput, 'date'>

export interface DatedAthletePlanningResolution {
  readonly date: string
  readonly resolution: AthletePlanningResolution
}

/**
 * Resolves one immutable planning snapshot across several calendar dates.
 *
 * Dates are de-duplicated and returned in chronological order. Every item still
 * delegates to the authoritative single-date cohort-variant -> group fallback
 * policy, so range consumers cannot drift into a second selection algorithm.
 */
export function resolveAthletePlanningForDates(
  input: PlanningRangeResolutionInput,
  dates: readonly string[],
): readonly DatedAthletePlanningResolution[] {
  return [...new Set(dates)]
    .sort((first, second) => first.localeCompare(second))
    .map(date => ({
      date,
      resolution: resolveAthletePlanningOnDate({ ...input, date }),
    }))
}
