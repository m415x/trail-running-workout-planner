import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'

import { authorizeAuthenticatedCapability } from './authenticated-authorization'
import type { H4aAuthorizationEvidenceSource, H4aAuthorizationRequest } from './h4a-authorization-adapter'

/**
 * A request-local evaluator: loads the canonical H3 evidence once, then reuses
 * it for each capability decision. No new preset or authorization semantics.
 */
export function createCoachNavigationH3Authorizer(source: H4aAuthorizationEvidenceSource) {
  return async function load(
    access: RequireAuthenticatedActionResult,
    teamId: string,
  ): Promise<(request: H4aAuthorizationRequest) => { allowed: boolean }> {
    if (access.status !== 'authenticated') {
      return () => ({ allowed: false })
    }

    const [memberships, athleteProfiles, grants] = await Promise.all([
      source.loadMemberships(access.userId, teamId),
      source.loadAthleteProfiles(access.userId, teamId),
      source.loadGrants(access.userId, teamId),
    ])

    return (request) => {
      if (request.teamId !== teamId || request.resource.teamId !== teamId) {
        return { allowed: false }
      }
      return authorizeAuthenticatedCapability(access, {
        ...request,
        memberships,
        athleteProfiles,
        grants,
      })
    }
  }
}
