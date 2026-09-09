'use server'

import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { planningCohortMemberships, planningCohorts } from '@/db/schema'

const CURRENT_TEAM_ID = 'team_1'

/** Lists visible planning cohorts for the current development team. */
export async function getPlanningCohortsByTeam() {
  return db.query.planningCohorts.findMany({
    where: and(
      eq(planningCohorts.teamId, CURRENT_TEAM_ID),
      eq(planningCohorts.isDeleted, false),
    ),
    with: {
      group: true,
      memberships: {
        where: eq(planningCohortMemberships.isDeleted, false),
      },
      planningVariant: true,
    },
    orderBy: (cohorts, { asc }) => [asc(cohorts.status), asc(cohorts.name)],
  })
}

/** Gets one cohort with its persisted plan and complete membership history. */
export async function getPlanningCohortDetail(cohortId: string) {
  const cohort = await db.query.planningCohorts.findFirst({
    where: and(
      eq(planningCohorts.id, cohortId),
      eq(planningCohorts.teamId, CURRENT_TEAM_ID),
      eq(planningCohorts.isDeleted, false),
    ),
    with: {
      group: true,
      planningVariant: {
        with: {
          sourceGroupTrainingPlan: true,
        },
      },
      memberships: {
        where: eq(planningCohortMemberships.isDeleted, false),
        with: {
          athleteProfile: {
            with: {
              user: true,
            },
          },
        },
      },
    },
  })

  if (!cohort) return null

  if (cohort.planningVariant?.isDeleted) {
    cohort.planningVariant = null
  }

  cohort.memberships.sort((first, second) => {
    const nameComparison = first.athleteProfile.user.lastName.localeCompare(
      second.athleteProfile.user.lastName,
      'es',
    )

    return nameComparison || second.startDate.localeCompare(first.startDate)
  })

  return cohort
}
