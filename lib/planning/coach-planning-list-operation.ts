import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import type { ActiveTeamContextResult } from '@/lib/authorization/active-team-context'
import type { H4aAuthorizationRequest } from '@/lib/authorization/h4a-authorization-adapter'
import { createCoachPlanningListReader } from './coach-planning-list-reader'

type Authenticated = Extract<RequireAuthenticatedActionResult, { status: 'authenticated' }>
type Group = { id: string; teamId: string }
type Plan = { id: string; teamId: string; groupId: string }

export interface CoachPlanningListOperationDeps<TGroup extends Group, TPlan extends Plan> {
  authenticate(): Promise<RequireAuthenticatedActionResult>
  resolveActiveTeam(userId: string): Promise<ActiveTeamContextResult>
  authorize(access: RequireAuthenticatedActionResult, request: H4aAuthorizationRequest): Promise<{ allowed: boolean }>
  listGroups(teamId: string): Promise<TGroup[]>
  listPlans(groupIds: string[]): Promise<TPlan[]>
  authorizePlan(access: RequireAuthenticatedActionResult, plan: TPlan): Promise<boolean>
  now(): string
}

/** Server-owned composition shared by the Server Action and isolated SQLite tests. */
export function createCoachPlanningListOperation<TGroup extends Group, TPlan extends Plan>(
  deps: CoachPlanningListOperationDeps<TGroup, TPlan>,
) {
  let access: Authenticated | null = null
  let authorizedGroups: string[] = []
  return createCoachPlanningListReader<TPlan>({
    async resolveContext() {
      const current = await deps.authenticate()
      if (current.status !== 'authenticated') return { status: 'denied' }
      const team = await deps.resolveActiveTeam(current.userId)
      if (team.status === 'selection_required') return { status: 'selection_required' }
      if (team.status === 'invalid_context') return { status: 'invalid_context' }
      access = current
      return { status: 'resolved', actorId: current.userId, teamId: team.teamId }
    },
    async authorizeListing(context) {
      if (!access || access.userId !== context.actorId) return false
      const groups = await deps.listGroups(context.teamId)
      const team = await deps.authorize(access, {
        teamId: context.teamId,
        capability: 'planning.manage',
        resource: { teamId: context.teamId },
        at: deps.now(),
      })
      if (team.allowed) {
        authorizedGroups = groups.map(group => group.id)
        return true
      }
      const decisions = await Promise.all(groups.map(group => deps.authorize(access!, {
        teamId: context.teamId,
        capability: 'planning.manage',
        resource: { teamId: context.teamId, sportingGroupId: group.id },
        at: deps.now(),
      })))
      authorizedGroups = groups.filter((_group, index) => decisions[index]?.allowed).map(group => group.id)
      return authorizedGroups.length > 0
    },
    loadPlans: async () => authorizedGroups.length ? deps.listPlans(authorizedGroups) : [],
    authorizePlan: async (_context, plan) => Boolean(access && await deps.authorizePlan(access, plan)),
  })
}
