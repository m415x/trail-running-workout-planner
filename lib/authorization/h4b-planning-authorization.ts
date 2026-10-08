import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'

import type { ActiveTeamContextResult } from './active-team-context'
import type { H4aAuthorizationRequest } from './h4a-authorization-adapter'

/** Persisted ownership evidence; never derive these group IDs from client form fields. */
export interface H4bPlanningOwnership {
  teamId: string
  sportingGroupIds: readonly string[]
}

export interface H4bPlanningAuthorizationDeps {
  resolveActiveTeam(userId: string): Promise<ActiveTeamContextResult>
  loadOwnership(resourceId: string): Promise<H4bPlanningOwnership | null>
  authorize(
    access: RequireAuthenticatedActionResult,
    request: H4aAuthorizationRequest,
  ): Promise<{ allowed: boolean }>
}

export interface H4bPlanningAuthorizationRequest {
  resourceId: string
  at: string
}

/**
 * H4B orchestration over the existing H2 → H4A active-Team → H3 capability boundary.
 * Consumers supply only resource locators; the evidence loader owns persisted ownership.
 * Every affected Sporting Group must be individually covered by planning.manage.
 */
export function createH4bPlanningAuthorizationBoundary(deps: H4bPlanningAuthorizationDeps) {
  return {
    async authorize(
      access: RequireAuthenticatedActionResult,
      request: H4bPlanningAuthorizationRequest,
    ): Promise<{ allowed: false } | { allowed: boolean; teamId: string }> {
      if (access.status !== 'authenticated') return { allowed: false }

      const activeTeam = await deps.resolveActiveTeam(access.userId)
      if (activeTeam.status !== 'resolved') return { allowed: false }

      const teamId = activeTeam.teamId
      const ownership = await deps.loadOwnership(request.resourceId)
      if (!ownership || ownership.teamId !== teamId) {
        return { allowed: false, teamId }
      }

      const groups = ownership.sportingGroupIds
      if (
        groups.length === 0
        || groups.some((groupId) => !groupId.trim())
        || new Set(groups).size !== groups.length
      ) {
        return { allowed: false, teamId }
      }

      // Evaluate every resource, not just the first matching group. Never promote
      // partial SPORTING_GROUP coverage into Team-wide authorization.
      const decisions = await Promise.all(groups.map((sportingGroupId) =>
        deps.authorize(access, {
          teamId,
          capability: 'planning.manage',
          resource: { teamId, sportingGroupId },
          at: request.at,
        }),
      ))

      return { allowed: decisions.every((decision) => decision.allowed), teamId }
    },
  }
}
