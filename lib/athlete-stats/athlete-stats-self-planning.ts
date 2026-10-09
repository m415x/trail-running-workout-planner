import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { athleteProfiles, groupHistoryRecords, groupTrainingPlans, planningCohortMemberships } from '@/db/schema'
import { resolveAthleteGroupOnDate, resolveAthletePlanningOnDate } from '@/lib/planning-cohorts/planning-resolution'

/**
 * H5B internal projection: accepts only the server-authorized SELF subject.
 * Never uses planning.manage or a Coach-facing action. Missing subject is a
 * source failure, not proof that there are no applicable competitions.
 */
export async function getSelfPlanningResolutionOnDate(athleteId: string, teamId: string, date: string) {
  const athlete = await db.query.athleteProfiles.findFirst({
    where: and(
      eq(athleteProfiles.id, athleteId),
      eq(athleteProfiles.teamId, teamId),
      eq(athleteProfiles.isDeleted, false),
    ),
    with: { groupHistory: { where: eq(groupHistoryRecords.isDeleted, false) } },
  })
  if (!athlete) throw new Error('Athlete Stats SELF subject unavailable')

  const groupResolution = resolveAthleteGroupOnDate(athlete.groupId, athlete.groupHistory, date)
  const memberships = await db.query.planningCohortMemberships.findMany({
    where: and(
      eq(planningCohortMemberships.athleteProfileId, athlete.id),
      eq(planningCohortMemberships.isDeleted, false),
    ),
    with: {
      planningCohort: {
        with: { planningVariant: { with: { macrocycles: true } } },
      },
    },
  })

  const basePlans = groupResolution.groupId === null
    ? []
    : await db.query.groupTrainingPlans.findMany({
      where: and(
        eq(groupTrainingPlans.groupId, groupResolution.groupId),
        eq(groupTrainingPlans.isDeleted, false),
      ),
      with: { group: true, macrocycles: true },
    })

  if (memberships.some((membership) =>
    membership.planningCohort.teamId !== teamId
    || membership.planningCohort.isDeleted
  )) {
    throw new Error('Athlete Stats SELF cohort scope mismatch')
  }
  const visibleBasePlans = basePlans.filter((plan) =>
    plan.group.teamId === teamId && !plan.group.isDeleted,
  )
  if (visibleBasePlans.length !== basePlans.length) {
    throw new Error('Athlete Stats SELF plan scope mismatch')
  }

  const resolution = resolveAthletePlanningOnDate({
    athleteTeamId: teamId,
    currentGroupId: athlete.groupId,
    groupChanges: athlete.groupHistory,
    memberships: memberships.map((membership) => ({
      ...membership,
      cohort: membership.planningCohort,
    })),
    basePlans: visibleBasePlans,
    date,
  })

  return { resolution }
}
