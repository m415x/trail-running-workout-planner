import { and, eq, inArray } from 'drizzle-orm'

import { db } from '@/db'
import {
  athleteProfiles, sessions, groupSessionPrescriptions, groupHistoryRecords,
  planningCohortMemberships, groupTrainingPlans, microcycles, mesocycles, macrocycles,
} from '@/db/schema'
import { createH5aSelfNextServerContext } from '@/lib/authorization/h5a-self-next-server'
import { createH5aEffectiveSessionBoundary } from './effective-self-session-boundary'

/** Persisted server-side sporting evidence. Session ID is only a lookup locator. */
export function createH5aEffectiveSessionNextServerBoundary() {
  const selfContext = createH5aSelfNextServerContext()
  return createH5aEffectiveSessionBoundary({
    resolveSelf: (access, request) => selfContext.resolve(access, request),
    async loadSessionEvidence(self, sessionId) {
      const athlete = await db.query.athleteProfiles.findFirst({
        where: and(
          eq(athleteProfiles.id, self.athleteProfileId),
          eq(athleteProfiles.userId, self.userId),
          eq(athleteProfiles.teamId, self.teamId),
          eq(athleteProfiles.isActive, true),
          eq(athleteProfiles.isDeleted, false),
        ),
      })
      if (!athlete) return null

      const session = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.id, sessionId),
          eq(sessions.teamId, self.teamId),
          eq(sessions.isDeleted, false),
        ),
        with: {
          sessionPrescriptions: {
            where: eq(groupSessionPrescriptions.isDeleted, false),
          },
        },
      })
      if (!session) return null

      const locator = loadEffectiveSessionLocatorFromDatabase({
        self: {
          userId: self.userId,
          teamId: self.teamId,
          athleteProfileId: self.athleteProfileId,
        },
        athlete,
        session,
        prescriptions: session.sessionPrescriptions,
      })
      if (locator.status !== 'resolved') return null

      const groupChanges = await db.select().from(groupHistoryRecords).where(and(
        eq(groupHistoryRecords.athleteId, athlete.id),
        eq(groupHistoryRecords.isDeleted, false),
      ))
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
      const relevantGroupIds = [...new Set([
        athlete.groupId,
        ...groupChanges.flatMap(change => [change.previousGroupId, change.newGroupId]),
      ].filter((id): id is string => id !== null))]
      const basePlans = relevantGroupIds.length === 0 ? [] : await db.query.groupTrainingPlans.findMany({
        where: and(
          inArray(groupTrainingPlans.groupId, relevantGroupIds),
          eq(groupTrainingPlans.isDeleted, false),
        ),
        with: { macrocycles: true },
      })

      const microcycleIds = [...new Set(locator.prescriptions.map(p => p.microcycleId))]
      const lineages = microcycleIds.length === 0 ? [] : await db.select({
        microcycleId: microcycles.id,
        groupTrainingPlanId: groupTrainingPlans.id,
      })
        .from(microcycles)
        .innerJoin(mesocycles, eq(microcycles.mesocycleId, mesocycles.id))
        .innerJoin(macrocycles, eq(mesocycles.macrocycleId, macrocycles.id))
        .innerJoin(groupTrainingPlans, eq(macrocycles.groupTrainingPlanId, groupTrainingPlans.id))
        .where(inArray(microcycles.id, microcycleIds))
      const planByMicrocycle = new Map(lineages.map(row => [row.microcycleId, row.groupTrainingPlanId]))

      return {
        athleteId: athlete.id,
        athleteTeamId: athlete.teamId,
        currentGroupId: athlete.groupId,
        groupChanges,
        memberships: memberships.map(membership => ({
          id: membership.id,
          startDate: membership.startDate,
          endDate: membership.endDate,
          isDeleted: membership.isDeleted,
          cohort: {
            id: membership.planningCohort.id,
            teamId: membership.planningCohort.teamId,
            groupId: membership.planningCohort.groupId,
            status: membership.planningCohort.status,
            isDeleted: membership.planningCohort.isDeleted,
            planningVariant: membership.planningCohort.planningVariant
              ? {
                  id: membership.planningCohort.planningVariant.id,
                  groupId: membership.planningCohort.planningVariant.groupId,
                  planningCohortId: membership.planningCohort.planningVariant.planningCohortId,
                  status: membership.planningCohort.planningVariant.status,
                  isDeleted: membership.planningCohort.planningVariant.isDeleted,
                  macrocycles: membership.planningCohort.planningVariant.macrocycles,
                }
              : null,
          },
        })),
        basePlans: basePlans.map(plan => ({
          id: plan.id, groupId: plan.groupId, planningCohortId: plan.planningCohortId,
          status: plan.status, isDeleted: plan.isDeleted, macrocycles: plan.macrocycles,
        })),
        session: {
          id: session.id, teamId: session.teamId, date: session.date, isDeleted: session.isDeleted,
        },
        prescriptions: locator.prescriptions.flatMap(prescription => {
          const groupTrainingPlanId = planByMicrocycle.get(prescription.microcycleId)
          return groupTrainingPlanId ? [{
            id: prescription.id,
            sessionId: prescription.sessionId,
            groupId: prescription.groupId,
            microcycleId: prescription.microcycleId,
            groupTrainingPlanId,
          }] : []
        }),
      }
    },
  })
}

/**
 * Validates persisted Drizzle locator rows before passing the session and
 * prescriptions into effective planning resolution. This does NOT, by itself,
 * authorize an effective sporting plan or an Athlete action.
 */
export function loadEffectiveSessionLocatorFromDatabase<
  P extends { id: string; sessionId: string; isDeleted: boolean | number },
>(input: {
  self: { userId: string; teamId: string; athleteProfileId: string }
  athlete: {
    id: string; userId: string | null; teamId: string;
    isDeleted: boolean | number; isActive: boolean | number
  } | null
  session: { id: string; teamId: string; isDeleted: boolean | number } | null
  prescriptions: readonly P[]
}): { status: 'denied' } | { status: 'resolved'; prescriptions: P[] } {
  const { self, athlete, session } = input
  if (
    !self.userId || !self.teamId || !self.athleteProfileId
    || !athlete || athlete.id !== self.athleteProfileId
    || athlete.userId !== self.userId || athlete.teamId !== self.teamId
    || Boolean(athlete.isDeleted) || !Boolean(athlete.isActive)
    || !session || session.teamId !== self.teamId
    || Boolean(session.isDeleted)
  ) return { status: 'denied' }

  return {
    status: 'resolved',
    prescriptions: input.prescriptions.filter(
      prescription => prescription.sessionId === session.id && !Boolean(prescription.isDeleted),
    ),
  }
}
