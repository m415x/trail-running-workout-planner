import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import type { ActiveTeamContextResult } from '@/lib/authorization/active-team-context'
import type { H4aAuthorizationRequest } from '@/lib/authorization/h4a-authorization-adapter'

type Group = { id: string; teamId: string }

export interface PlanningCreationEligibilityDeps<TGroup extends Group> {
  authenticate(): Promise<RequireAuthenticatedActionResult>
  resolveActiveTeam(userId: string): Promise<ActiveTeamContextResult>
  listActiveGroups(teamId: string): Promise<TGroup[]>
  authorize(access: RequireAuthenticatedActionResult, request: H4aAuthorizationRequest): Promise<{ allowed: boolean }>
  now(): string
}

/** Advisory CTA check. The mutation writer always revalidates H2/H3/group/H4A. */
export function createPlanningCreationEligibility<TGroup extends Group>(
  deps: PlanningCreationEligibilityDeps<TGroup>,
) {
  return {
    async check(): Promise<boolean> {
      try {
        const access = await deps.authenticate()
        if (access.status !== 'authenticated') return false

        const team = await deps.resolveActiveTeam(access.userId)
        if (team.status !== 'resolved') return false

        const groups = await deps.listActiveGroups(team.teamId)
        for (const group of groups) {
          if (group.teamId !== team.teamId) continue
          const decision = await deps.authorize(access, {
            teamId: team.teamId,
            capability: 'planning.manage',
            resource: { teamId: team.teamId, sportingGroupId: group.id },
            at: deps.now(),
          })
          if (decision.allowed) return true
        }
        return false
      } catch {
        return false
      }
    },
  }
}
