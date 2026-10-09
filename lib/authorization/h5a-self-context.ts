import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import type { CapabilityKey } from './capability-catalog'

import { authorizeEffectiveCapability, type EffectiveTeamMembership } from './effective-authorization'
import { resolveSelfAthleteProfile, type AthleteProfileLink } from './scope-resolution'

interface H5aSelfContextDeps {
  resolveActiveTeam(userId: string): Promise<{ status: string; teamId?: string }>
  loadMemberships(userId: string, teamId: string): Promise<readonly EffectiveTeamMembership[]>
  loadAthleteProfiles(userId: string, teamId: string): Promise<readonly AthleteProfileLink[]>
}

export type H5aSelfContextResult =
  | { status: 'denied' }
  | { status: 'resolved'; userId: string; teamId: string; athleteProfileId: string }

/**
 * Resolve sporting SELF from H2 user identity, validated active Team and H1
 * AthleteProfile linkage. Neither presets nor client-selected IDs can supply
 * the sporting subject. Missing, conflicting or stale evidence fails closed.
 *
 * Callers still authorize the concrete H5A capability against the returned
 * resource before reading or writing domain records.
 */
export function createH5aSelfContextBoundary(deps: H5aSelfContextDeps) {
  return {
    async resolve(
      access: RequireAuthenticatedActionResult,
      input: { at: string; capability?: 'planning.self.read' | 'workout_log.self.manage' },
    ): Promise<H5aSelfContextResult> {
      if (access.status !== 'authenticated') return { status: 'denied' }
      const capability: CapabilityKey = input.capability ?? 'planning.self.read'
      if (capability !== 'planning.self.read' && capability !== 'workout_log.self.manage') return { status: 'denied' }

      try {
        const team = await deps.resolveActiveTeam(access.userId)
        if (team.status !== 'resolved' || typeof team.teamId !== 'string') {
          return { status: 'denied' }
        }

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
          capability,
          resource: { teamId: team.teamId, athleteProfileId },
          at: input.at,
          memberships,
          athleteProfiles: profiles,
          grants: [],
          requiredScope: 'self',
        }).allowed

        if (!allowed) return { status: 'denied' }

        return {
          status: 'resolved',
          userId: access.userId,
          teamId: team.teamId,
          athleteProfileId,
        }
      } catch {
        return { status: 'denied' }
      }
    },
  }
}
