import { getSelfPlanningResolutionOnDate } from './athlete-stats-self-planning'
import { readEffectivePlanRealComparison } from '@/lib/realized-training/effective-plan-real-reader'
import type { PlanRealComparisonWindow } from '@/types/training/plan-real-comparison.types'

/** Internal SELF query. Caller must have resolved H5B Stats authority.
 * Never delegates to Coach actions or requires planning.manage. */
export async function getSelfAthletePlanRealComparison(
  athleteId: string,
  teamId: string,
  window: PlanRealComparisonWindow,
) {
  return readEffectivePlanRealComparison({
    athleteId, teamId, window,
    resolvePlanning: async date => (await getSelfPlanningResolutionOnDate(athleteId, teamId, date))?.resolution ?? null,
  })
}
