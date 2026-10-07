import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'

import {
  authorizeAuthenticatedCapability,
  type AuthenticatedAuthorizationInput,
} from './authenticated-authorization'
import type { EffectiveTeamMembership } from './effective-authorization'
import type { AuthorizationGrantRecord } from './grant-lifecycle'
import type { AthleteProfileLink } from './scope-resolution'

export interface H4aAuthorizationEvidenceSource {
  loadMemberships(
    userId: string,
    teamId: string,
  ): Promise<readonly EffectiveTeamMembership[]>
  loadAthleteProfiles(
    userId: string,
    teamId: string,
  ): Promise<readonly AthleteProfileLink[]>
  loadGrants(
    userId: string,
    teamId: string,
  ): Promise<readonly AuthorizationGrantRecord[]>
}

export type H4aAuthorizationRequest = Omit<
  AuthenticatedAuthorizationInput,
  'memberships' | 'athleteProfiles' | 'grants'
>

export function createH4aAuthorizationAdapter(
  source: H4aAuthorizationEvidenceSource,
) {
  return {
    async authorize(
      access: RequireAuthenticatedActionResult,
      request: H4aAuthorizationRequest,
    ) {
      if (access.status !== 'authenticated') {
        return { allowed: false }
      }

      const [memberships, athleteProfiles, grants] = await Promise.all([
        source.loadMemberships(access.userId, request.teamId),
        source.loadAthleteProfiles(access.userId, request.teamId),
        source.loadGrants(access.userId, request.teamId),
      ])

      return authorizeAuthenticatedCapability(access, {
        ...request,
        memberships,
        athleteProfiles,
        grants,
      })
    },
  }
}
