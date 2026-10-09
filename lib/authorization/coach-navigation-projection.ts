import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'

import type { ActiveTeamContextResult } from './active-team-context'
import type { H4aAuthorizationRequest } from './h4a-authorization-adapter'
import { COACH_NAVIGATION_POLICY, visibleCoachNavigationDestinations } from './coach-navigation-policy'
import type { CapabilityKey } from './capability-catalog'

export interface CoachNavigationProjectionDeps {
  resolveActiveTeam(userId: string): Promise<ActiveTeamContextResult>
  authorize?(
    access: RequireAuthenticatedActionResult,
    request: H4aAuthorizationRequest,
  ): Promise<{ allowed: boolean }>
  loadAuthorizer?(
    access: RequireAuthenticatedActionResult,
    teamId: string,
  ): Promise<(request: H4aAuthorizationRequest) => { allowed: boolean }>
}

/**
 * Server-side orchestration of existing H2 / H4A / H3 authority.
 * The result only controls link discoverability; resource guards remain authoritative.
 */
export function createCoachNavigationProjection(deps: CoachNavigationProjectionDeps) {
  return async function project(access: RequireAuthenticatedActionResult): Promise<string[]> {
    if (access.status !== 'authenticated') return []

    const basic = visibleCoachNavigationDestinations(COACH_NAVIGATION_POLICY, new Set<CapabilityKey>())

    try {
      const team = await deps.resolveActiveTeam(access.userId)
      if (team.status !== 'resolved') return basic

      const keys = [...new Set(
        COACH_NAVIGATION_POLICY.flatMap(({ visibility }) =>
          visibility.kind === 'capability' ? [visibility.key] : [],
        ),
      )]

      // Fail closed as one coherent projection: never expose a partially
      // evaluated capability set after unavailable authorization evidence.
      const evaluator = deps.loadAuthorizer
        ? await deps.loadAuthorizer(access, team.teamId)
        : null
      if (!evaluator && !deps.authorize) return basic
      const at = new Date().toISOString()
      const decisions = await Promise.all(keys.map(async (capability) => ({
        capability,
        decision: evaluator
          ? evaluator({ teamId: team.teamId, capability, resource: { teamId: team.teamId }, at })
          : await deps.authorize!(access, {
            teamId: team.teamId,
            capability,
            resource: { teamId: team.teamId },
            at,
          }),
      })))

      const allowed = new Set<CapabilityKey>(
        decisions.filter(({ decision }) => decision.allowed).map(({ capability }) => capability),
      )

      return visibleCoachNavigationDestinations(COACH_NAVIGATION_POLICY, allowed)
    } catch {
      return basic
    }
  }
}
