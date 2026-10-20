import type { AthleteRaceRegistrationItem, AthleteRaceRegistrationsProjection } from '@/lib/athlete-stats/athlete-race-registration-projection'

type SelfRegistrationResult =
  | { status: 'loaded'; data: AthleteRaceRegistrationsProjection }
  | { status: 'denied' | 'error' }

type Milestone = AthleteRaceRegistrationItem & {
  kind: 'registration' | 'explicit-plan-goal'
}

export type PlanCompetitionMilestoneResult =
  | { status: 'loaded'; milestones: Milestone[] }
  | { status: 'denied' | 'error' }

/**
 * Adapts the established stats.self.read registration boundary to the Plan
 * presentation. The caller must independently authorize any explicit planning
 * goal relationship; a registration alone never establishes that relationship.
 */
export async function readAthletePlanCompetitionMilestones(dependencies: {
  readSelfRegistrations: () => Promise<SelfRegistrationResult>
  explicitPlanGoalRegistrationIds: readonly string[]
}): Promise<PlanCompetitionMilestoneResult> {
  try {
    const result = await dependencies.readSelfRegistrations()
    if (result.status !== 'loaded') return { status: result.status }

    const goals = new Set(dependencies.explicitPlanGoalRegistrationIds)
    return {
      status: 'loaded',
      milestones: result.data.upcoming.map(registration => ({
        ...registration,
        kind: goals.has(registration.registrationId)
          ? 'explicit-plan-goal' as const
          : 'registration' as const,
      })),
    }
  } catch {
    return { status: 'error' }
  }
}
