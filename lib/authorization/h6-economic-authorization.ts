import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import { authorizeEffectiveCapability, type EffectiveTeamMembership } from './effective-authorization'
import type { CapabilityKey } from './capability-catalog'

type EconomicCapability = Extract<CapabilityKey, 'economy.manage' | 'economic_policy.manage'>

interface H6EconomicAuthorizationDependencies {
  resolveActiveTeam(userId: string): Promise<{ status: string; teamId?: string }>
  loadMemberships(userId: string, teamId: string): Promise<readonly EffectiveTeamMembership[]>
  resolveResourceTeam(resourceId: string, teamId: string): Promise<string | null>
}

/**
 * Pure application boundary for economic operations. The caller supplies a
 * server-authenticated EPT actor; resource ownership is independently loaded
 * from persistence. No caller-provided Team ID is authorization evidence.
 */
export function createH6EconomicAuthorizationBoundary(
  deps: H6EconomicAuthorizationDependencies,
) {
  return {
    async authorize(
      access: RequireAuthenticatedActionResult,
      request: { at: string; capability: EconomicCapability; resourceId: string },
    ): Promise<{ allowed: boolean; teamId?: string }> {
      if (access.status !== 'authenticated') return { allowed: false }
      if (!request.resourceId || !request.at) return { allowed: false }

      try {
        const team = await deps.resolveActiveTeam(access.userId)
        if (team.status !== 'resolved' || !team.teamId) return { allowed: false }

        const [memberships, ownerTeamId] = await Promise.all([
          deps.loadMemberships(access.userId, team.teamId),
          deps.resolveResourceTeam(request.resourceId, team.teamId),
        ])
        if (ownerTeamId !== team.teamId) return { allowed: false }

        const allowed = authorizeEffectiveCapability({
          authenticatedUserId: access.userId,
          teamId: team.teamId,
          capability: request.capability,
          resource: { teamId: ownerTeamId },
          at: request.at,
          memberships,
          athleteProfiles: [],
          grants: [],
          requiredScope: 'team',
        }).allowed

        return allowed ? { allowed: true, teamId: team.teamId } : { allowed: false }
      } catch {
        return { allowed: false }
      }
    },
  }
}
