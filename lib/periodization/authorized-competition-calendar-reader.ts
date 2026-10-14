import { and, eq } from 'drizzle-orm'
import type { db } from '@/db'
import { athleteGroups, groupTrainingPlans } from '@/db/schema'
import type { EptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction, type RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import type { ActiveTeamContextResult } from '@/lib/authorization/active-team-context'
import type { H4aActiveTeamAuthorizationRequest } from '@/lib/authorization/h4a-active-team-authorization'
import { getCompetitionCalendar } from './competition-calendar-service'
import type { CompetitionEntry } from '@/types/training/competition-entry.types'

/**
 * KAN-792: real plan-owned calendar read. H2 and H3 inputs are external
 * evidence, while the existing H2 verifier, H4A authorization and Drizzle
 * repository remain executed on every call. A plan ID is never a credential.
 */
export function createAuthorizedCompetitionCalendarReader(deps: {
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
    async read(planId: string): Promise<
      | { status: 'denied' }
      | { status: 'allowed'; competitions: CompetitionEntry[] }
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
        capability: 'planning.manage',
        resource: { teamId: activeTeam.teamId },
        at: deps.now?.() ?? new Date().toISOString(),
        requiredScope: 'team',
      })
      if (!decision.allowed || (decision.teamId !== undefined && decision.teamId !== activeTeam.teamId)) {
        return { status: 'denied' }
      }

      return { status: 'allowed', competitions: getCompetitionCalendar(planId, deps.database) }
    },
  }
}
