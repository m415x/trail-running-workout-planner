import { getAthletePlanRealComparisonAction } from '@/app/actions/realized-training-actions'
import { deriveAthleteAdherence } from '@/lib/adherence/athlete-adherence'
import type { AthleteStatsSourceDependencies } from '@/lib/athlete-stats/athlete-stats-source-adapter'
import type { AthletePlanRealComparison, PlanRealComparisonWindow } from '@/types/training/plan-real-comparison.types'

type SubjectPeriod = Parameters<AthleteStatsSourceDependencies['getAdherence']>[0]

interface PlanRealComparisonResult {
  readonly success: boolean
  readonly data: AthletePlanRealComparison | null
}

export interface AthleteStatsAdherenceSourceDependencies {
  readonly getAthletePlanRealComparison: (
    athleteId: string,
    window: PlanRealComparisonWindow,
  ) => Promise<PlanRealComparisonResult>
}

const productionDependencies: AthleteStatsAdherenceSourceDependencies = {
  getAthletePlanRealComparison: getAthletePlanRealComparisonAction,
}

function periodKind(input: SubjectPeriod): PlanRealComparisonWindow['kind'] {
  const start = new Date(`${input.startDate}T00:00:00Z`)
  const end = new Date(`${input.endDate}T00:00:00Z`)
  const durationDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
  return durationDays <= 7 ? 'week' : 'month'
}

/** Reuses KAN-259 as evidence boundary and KAN-260 as the adherence derivation. */
export function createAthleteStatsAdherenceSource(
  dependencies: AthleteStatsAdherenceSourceDependencies = productionDependencies,
): Pick<AthleteStatsSourceDependencies, 'getAdherence'> {
  return {
    getAdherence: async (input) => {
      const window: PlanRealComparisonWindow = {
        kind: periodKind(input),
        startDate: input.startDate,
        endDate: input.endDate,
      }
      const result = await dependencies.getAthletePlanRealComparison(input.athleteId, window)
      const comparison = result.success ? result.data : null
      if (!comparison) throw new Error('Athlete Stats adherence source unavailable')
      if (comparison.athleteId !== input.athleteId || comparison.teamId !== input.teamId) {
        throw new Error('Athlete Stats adherence scope mismatch')
      }

      return deriveAthleteAdherence(comparison)
    },
  }
}
