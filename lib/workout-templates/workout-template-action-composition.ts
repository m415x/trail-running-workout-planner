import type { db } from '@/db'
import type { EptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction, type RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import type { ActiveTeamContextResult } from '@/lib/authorization/active-team-context'
import type { H4aActiveTeamAuthorizationRequest } from '@/lib/authorization/h4a-active-team-authorization'
import { resolveAuthorizedWorkoutTemplateTeam } from './authorized-workout-template-operations'
import { createWorkoutTemplateActionService } from './workout-template-action-service'

/**
 * Shared production/test composition. Only external session and Team evidence,
 * database and clock are supplied; H2 enforcement, Team authority and the
 * existing template repository remain real.
 */
export function createWorkoutTemplateActionComposition(deps: {
  database: typeof db
  readAccess(): Promise<EptSessionAccessState>
  resolveActiveTeam(userId: string): Promise<ActiveTeamContextResult>
  authorize(
    access: RequireAuthenticatedActionResult,
    request: H4aActiveTeamAuthorizationRequest,
  ): Promise<{ allowed: boolean; teamId?: string }>
  now?: () => string
}) {
  function freshAuthorization() {
    let authenticatedUserId: string | null = null
    return {
      authenticate: async () => {
        const access = await requireAuthenticatedEptAction({ readAccess: deps.readAccess })
        authenticatedUserId = access.status === 'authenticated' ? access.userId : null
        return access
      },
      resolveActiveTeam: async () => {
        if (!authenticatedUserId) return null
        const team = await deps.resolveActiveTeam(authenticatedUserId)
        return team.status === 'resolved' ? team.teamId : null
      },
      authorize: async (access: RequireAuthenticatedActionResult, teamId: string) => {
        const decision = await deps.authorize(access, {
          capability: 'planning.manage',
          resource: { teamId },
          requiredScope: 'team',
          at: deps.now?.() ?? new Date().toISOString(),
        })
        // A production H4A decision with another Team can never grant access.
        if (decision.teamId !== undefined && decision.teamId !== teamId) {
          return { allowed: false }
        }
        return { allowed: decision.allowed, teamId }
      },
    }
  }

  return {
    async authorize(): Promise<{ teamId: string } | null> {
      const teamId = await resolveAuthorizedWorkoutTemplateTeam(freshAuthorization())
      return teamId ? { teamId } : null
    },
    service() {
      return createWorkoutTemplateActionService({
        ...freshAuthorization(),
        database: deps.database,
        now: deps.now,
      })
    },
  }
}
