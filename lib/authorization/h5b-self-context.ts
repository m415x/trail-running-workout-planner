import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import { authorizeEffectiveCapability, type EffectiveTeamMembership } from './effective-authorization'
import { resolveSelfAthleteProfile, type AthleteProfileLink } from './scope-resolution'

export type H5bSelfReadCapability = 'stats.self.read' | 'physiology.self.read'

interface H5bSelfContextDeps {
  resolveActiveTeam(userId: string): Promise<{ status: string; teamId?: string }>
  loadMemberships(userId: string, teamId: string): Promise<readonly EffectiveTeamMembership[]>
  loadAthleteProfiles(userId: string, teamId: string): Promise<readonly AthleteProfileLink[]>
}

export type H5bSelfContextResult =
  | { status: 'denied' }
  | { status: 'resolved'; userId: string; teamId: string; athleteProfileId: string }

/**
 * H5B-only sporting SELF resolution. H2 identity, active Team, current membership,
 * dedicated non-delegable capability and one owned AthleteProfile are all required.
 * Client IDs cannot choose the subject; Coach authority is not inherited.
 */
export function createH5bSelfContextBoundary(deps: H5bSelfContextDeps) {
  return {
    async resolve(
      access: RequireAuthenticatedActionResult,
      input: { at: string; capability: H5bSelfReadCapability },
    ): Promise<H5bSelfContextResult> {
      if (access.status !== 'authenticated') return { status: 'denied' }
      if (input.capability !== 'stats.self.read' && input.capability !== 'physiology.self.read') {
        return { status: 'denied' }
      }

      try {
        const team = await deps.resolveActiveTeam(access.userId)
        if (team.status !== 'resolved' || !team.teamId) return { status: 'denied' }

        const [memberships, profiles] = await Promise.all([
          deps.loadMemberships(access.userId, team.teamId),
          deps.loadAthleteProfiles(access.userId, team.teamId),
        ])

        const athleteProfileId = resolveSelfAthleteProfile(profiles, {
          userId: access.userId,
          teamId: team.teamId,
        })
        if (!athleteProfileId) return { status: 'denied' }

        const allowed = authorizeEffectiveCapability({
          authenticatedUserId: access.userId,
          teamId: team.teamId,
          capability: input.capability,
          resource: { teamId: team.teamId, athleteProfileId },
          at: input.at,
          memberships,
          athleteProfiles: profiles,
          grants: [],
          requiredScope: 'self',
        }).allowed
        if (!allowed) return { status: 'denied' }

        return { status: 'resolved', userId: access.userId, teamId: team.teamId, athleteProfileId }
      } catch {
        return { status: 'denied' }
      }
    },
  }
}
