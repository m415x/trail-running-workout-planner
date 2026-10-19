import { and, eq } from 'drizzle-orm'
import type { db } from '@/db'
import { athleteGroups, groupTrainingPlans } from '@/db/schema'
import type { EptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction, type RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import type { ActiveTeamContextResult } from '@/lib/authorization/active-team-context'
import type { H4aActiveTeamAuthorizationRequest } from '@/lib/authorization/h4a-active-team-authorization'

/** A Team/Plan ID is never authorization evidence. No mutation occurs here. */
export function createAuthorizedCompetitionCalendarWriter(deps: {
  database: typeof db
  readAccess(): Promise<EptSessionAccessState>
  resolveActiveTeam(userId: string): Promise<ActiveTeamContextResult>
  authorize(
    access: RequireAuthenticatedActionResult,
    request: H4aActiveTeamAuthorizationRequest,
  ): Promise<{ allowed: boolean; teamId?: string }>
  now?: () => string
}) {
  return {
    async authorizePlan(planId: string): Promise<
      | { status: 'denied' }
      | { status: 'allowed'; teamId: string }
    > {
      const access = await requireAuthenticatedEptAction({ readAccess: deps.readAccess })
      if (access.status !== 'authenticated') return { status: 'denied' }

      const activeTeam = await deps.resolveActiveTeam(access.userId)
      if (activeTeam.status !== 'resolved') return { status: 'denied' }

      const owner = deps.database
        .select({ teamId: athleteGroups.teamId })
        .from(groupTrainingPlans)
        .innerJoin(athleteGroups, eq(groupTrainingPlans.groupId, athleteGroups.id))
        .where(and(
          eq(groupTrainingPlans.id, planId),
          eq(groupTrainingPlans.isDeleted, false),
          eq(athleteGroups.isDeleted, false),
        ))
        .get()
      if (!owner || owner.teamId !== activeTeam.teamId) return { status: 'denied' }

      const decision = await deps.authorize(access, {
        capability: 'competition.manage',
        resource: { teamId: activeTeam.teamId },
        at: deps.now?.() ?? new Date().toISOString(),
        requiredScope: 'team',
      })
      if (!decision.allowed || (decision.teamId !== undefined && decision.teamId !== activeTeam.teamId)) {
        return { status: 'denied' }
      }
      return { status: 'allowed', teamId: activeTeam.teamId }
    },
  }
}
