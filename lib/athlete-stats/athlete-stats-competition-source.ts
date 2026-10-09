import { getSelfPlanningResolutionOnDate } from './athlete-stats-self-planning'
import type { AthleteStatsSourceDependencies } from '@/lib/athlete-stats/athlete-stats-source-adapter'
import { getCompetitionCalendar } from '@/lib/periodization/competition-calendar-service'
import { deriveCompetitionContext } from '@/lib/periodization/competition-context'
import type { CompetitionEntry } from '@/types/training/competition-entry.types'

type SubjectPeriod = Parameters<AthleteStatsSourceDependencies['getCompetitionContext']>[0]

type PlanningResolutionResult = Awaited<ReturnType<typeof getSelfPlanningResolutionOnDate>>

export interface AthleteStatsCompetitionSourceDependencies {
  readonly getSelfPlanningResolutionOnDate: (
    athleteId: string,
    teamId: string,
    date: string,
  ) => Promise<PlanningResolutionResult>
  readonly getCompetitionCalendar: (planId: string) => readonly CompetitionEntry[]
}

const productionDependencies: AthleteStatsCompetitionSourceDependencies = {
  getSelfPlanningResolutionOnDate,
  getCompetitionCalendar,
}

const emptyContext = {
  primaryCompetition: null,
  intermediateCompetitions: [],
} as const

/**
 * Resolves the athlete's applicable plan before reading Competition persistence.
 * A non-applicable plan is valid absence; an ambiguous plan or calendar is a
 * technical source failure so Stats never combines competitions across plans.
 */
export function createAthleteStatsCompetitionSource(
  dependencies: AthleteStatsCompetitionSourceDependencies = productionDependencies,
): Pick<AthleteStatsSourceDependencies, 'getCompetitionContext'> {
  return {
    getCompetitionContext: async (input: SubjectPeriod) => {
      const planning = await dependencies.getSelfPlanningResolutionOnDate(
        input.athleteId,
        input.teamId,
        input.endDate,
      )
      const resolution = planning?.resolution

      if (!resolution) throw new Error('Athlete Stats SELF planning source unavailable')
      if (resolution.status === 'none') return emptyContext
      if (resolution.status === 'conflict') {
        throw new Error('Athlete Stats competition planning conflict')
      }

      const entries = dependencies.getCompetitionCalendar(resolution.planId)
      const result = deriveCompetitionContext(entries)
      if (!result.valid) {
        throw new Error('Athlete Stats competition calendar conflict')
      }

      return result.context
    },
  }
}
