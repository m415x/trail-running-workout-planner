import type { ActiveTeamContextResult } from './active-team-context'
import type { H4aAuthorizationEvidenceSource } from './h4a-authorization-adapter'
import { createCoachNavigationH3Authorizer } from './coach-navigation-h3-authorizer'
import { createCoachNavigationProjection } from './coach-navigation-projection'

export interface CoachNavigationServerProjectionDeps {
  resolveActiveTeam(userId: string): Promise<ActiveTeamContextResult>
  evidence: H4aAuthorizationEvidenceSource
}

/**
 * Request-scoped server composition. H3 remains the authority:
 * the projection only determines which Coach navigation links to display.
 */
export function createCoachNavigationServerProjection(
  deps: CoachNavigationServerProjectionDeps,
) {
  return createCoachNavigationProjection({
    resolveActiveTeam: deps.resolveActiveTeam,
    loadAuthorizer: createCoachNavigationH3Authorizer(deps.evidence),
  })
}
