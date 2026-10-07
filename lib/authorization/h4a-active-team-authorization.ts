import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'

import type { ActiveTeamContextResult } from './active-team-context'
import type {
  H4aAuthorizationRequest,
} from './h4a-authorization-adapter'

export interface H4aActiveTeamAuthorizationDeps {
  resolveActiveTeam(userId: string): Promise<ActiveTeamContextResult>
  authorize(
    access: RequireAuthenticatedActionResult,
    request: H4aAuthorizationRequest,
  ): Promise<{ allowed: boolean }>
}

export type H4aActiveTeamAuthorizationRequest = Omit<
  H4aAuthorizationRequest,
  'teamId'
>

export function createH4aActiveTeamAuthorizationBoundary(
  deps: H4aActiveTeamAuthorizationDeps,
) {
  return {
    async authorize(
      access: RequireAuthenticatedActionResult,
      request: H4aActiveTeamAuthorizationRequest,
    ): Promise<
      | { allowed: false }
      | { allowed: boolean; teamId: string }
    > {
      if (access.status !== 'authenticated') {
        return { allowed: false }
      }

      const team = await deps.resolveActiveTeam(access.userId)

      if (team.status !== 'resolved') {
        return { allowed: false }
      }

      const decision = await deps.authorize(access, {
        ...request,
        teamId: team.teamId,
      })

      return {
        allowed: decision.allowed,
        teamId: team.teamId,
      }
    },
  }
}
