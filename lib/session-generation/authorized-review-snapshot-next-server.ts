import { and, eq, gt } from 'drizzle-orm'

import { db } from '@/db'
import { groupTrainingPlans, athleteGroups } from '@/db/schema'
import { sessionGenerationReviewSnapshots } from '@/db/session-generation-review-snapshot-schema'
import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction, type RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { createActiveTeamNextServerContext } from '@/lib/authorization/active-team-next-server'
import { createH4aNextServerAuthorizationBoundary } from '@/lib/authorization/h4a-next-server-authorization'
import {
  resolveAuthorizedReviewSnapshotScope,
  type ReviewSnapshotScopeResult,
} from '@/lib/session-generation/authorized-review-snapshot-scope'

/**
 * KAN-790/T5.1: real Next.js-server evidence for review-snapshot scope.
 *
 * This is deliberately read-only: the caller must separately enforce current
 * source freshness, write authorization and transactional confirmation.
 * A snapshot ID is merely a locator; never evidence of identity or capability.
 */
export async function authorizeReviewSnapshotNextServer(
  request: { readonly groupTrainingPlanId: string; readonly snapshotId?: string },
): Promise<ReviewSnapshotScopeResult> {
  let authenticatedAccess: RequireAuthenticatedActionResult | null = null
  const activeTeam = createActiveTeamNextServerContext()
  const authorization = createH4aNextServerAuthorizationBoundary()

  return resolveAuthorizedReviewSnapshotScope(request, {
    authenticate: async () => {
      const supabase = await createSupabaseServerClient()
      const access = await requireAuthenticatedEptAction({
        readAccess: () => readEptSessionAccessState(
          supabase.auth,
          createExternalIdentityLookup(),
        ),
      })
      if (access.status !== 'authenticated') return null
      authenticatedAccess = access
      return access.userId
    },

    resolveActiveTeam: async (userId) => {
      const selected = await activeTeam.resolve(userId)
      return selected.status === 'resolved' ? selected.teamId : null
    },

    readPlan: async (groupTrainingPlanId) => {
      const plan = await db.select({
        id: groupTrainingPlans.id,
        groupId: groupTrainingPlans.groupId,
        teamId: athleteGroups.teamId,
        planningCohortId: groupTrainingPlans.planningCohortId,
      }).from(groupTrainingPlans)
        .innerJoin(athleteGroups, eq(groupTrainingPlans.groupId, athleteGroups.id))
        .where(and(
          eq(groupTrainingPlans.id, groupTrainingPlanId),
          eq(groupTrainingPlans.isDeleted, false),
          eq(athleteGroups.isDeleted, false),
        )).get()
      return plan ?? null
    },

    authorizePlanning: async (userId, teamId, groupId) => {
      const access = authenticatedAccess
      if (!access || access.status !== 'authenticated' || access.userId !== userId) {
        return false
      }
      const decision = await authorization.authorize(access, {
        capability: 'planning.manage',
        resource: { teamId, sportingGroupId: groupId },
        at: new Date().toISOString(),
      })
      return decision.allowed && 'teamId' in decision && decision.teamId === teamId
    },

    readSnapshot: async (id) => {
      const now = new Date().toISOString()
      const row = await db.select({
        id: sessionGenerationReviewSnapshots.id,
        userId: sessionGenerationReviewSnapshots.userId,
        teamId: sessionGenerationReviewSnapshots.teamId,
        groupTrainingPlanId: sessionGenerationReviewSnapshots.groupTrainingPlanId,
        groupId: sessionGenerationReviewSnapshots.groupId,
        planningCohortId: sessionGenerationReviewSnapshots.planningCohortId,
      }).from(sessionGenerationReviewSnapshots)
        .where(and(
          eq(sessionGenerationReviewSnapshots.id, id),
          eq(sessionGenerationReviewSnapshots.status, 'active'),
          gt(sessionGenerationReviewSnapshots.expiresAt, now),
        )).get()
      return row ?? null
    },
  })
}
