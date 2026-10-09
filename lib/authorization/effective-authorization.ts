import type { TeamMembershipPreset, UserRole } from '@/types'

import {
  getCapabilityDefinition,
  type CapabilityKey,
} from './capability-catalog'
import {
  isAuthorizationGrantActive,
  type AuthorizationGrantRecord,
} from './grant-lifecycle'
import {
  resolveSelfAthleteProfile,
  scopeCoversResource,
  type AthleteProfileLink,
  type AuthorizationScope,
  type ScopedResourceIdentity,
} from './scope-resolution'

export interface EffectiveTeamMembership {
  userId: string
  teamId: string
  preset: TeamMembershipPreset
  effectiveFrom: string
  effectiveUntil: string | null
  isActive: boolean
}

export interface EffectiveAuthorizationInput {
  authenticatedUserId: string
  teamId: string
  capability: CapabilityKey
  resource: ScopedResourceIdentity
  at: string
  memberships: readonly EffectiveTeamMembership[]
  athleteProfiles: readonly AthleteProfileLink[]
  grants: readonly AuthorizationGrantRecord[]
  requiredScope?: AuthorizationScope
  legacyUserRole?: UserRole
}

export interface EffectiveAuthorizationDecision {
  allowed: boolean
}

function isMembershipActive(
  membership: EffectiveTeamMembership,
  at: string,
): boolean {
  if (!membership.isActive) return false
  if (at < membership.effectiveFrom) return false
  if (membership.effectiveUntil !== null && at >= membership.effectiveUntil) {
    return false
  }
  return true
}

function resolveActiveMembership(
  input: EffectiveAuthorizationInput,
): EffectiveTeamMembership | null {
  const matches = input.memberships.filter((membership) =>
    membership.userId === input.authenticatedUserId
    && membership.teamId === input.teamId
    && isMembershipActive(membership, input.at),
  )

  return matches.length === 1 ? matches[0] ?? null : null
}

function hasBaseCapability(
  preset: TeamMembershipPreset,
  capability: CapabilityKey,
): boolean {
  return getCapabilityDefinition(capability).basePresets.includes(preset)
}

function scopeForBaseCapability(
  input: EffectiveAuthorizationInput,
): AuthorizationScope {
  return getCapabilityDefinition(input.capability).requiredScope ?? input.requiredScope ?? 'team'
}

function hasGrantCapability(
  input: EffectiveAuthorizationInput,
  selfAthleteProfileId: string | null,
): boolean {
  if (!getCapabilityDefinition(input.capability).delegable) return false
  return input.grants.some((grant) => {
    if (grant.beneficiaryUserId !== input.authenticatedUserId) return false
    if (grant.teamId !== input.teamId) return false
    if (grant.capability !== input.capability) return false
    if (!isAuthorizationGrantActive(grant, input.at)) return false

    return scopeCoversResource({
      scope: grant.scope,
      actorTeamId: input.teamId,
      selfAthleteProfileId,
      scopeTargetId: grant.scopeTargetId,
      resource: input.resource,
    })
  })
}

export function authorizeEffectiveCapability(
  input: EffectiveAuthorizationInput,
): EffectiveAuthorizationDecision {
  if (input.resource.teamId !== input.teamId) {
    return { allowed: false }
  }

  const membership = resolveActiveMembership(input)
  if (!membership) {
    return { allowed: false }
  }

  const selfAthleteProfileId = resolveSelfAthleteProfile(
    input.athleteProfiles,
    {
      userId: input.authenticatedUserId,
      teamId: input.teamId,
    },
  )

  if (hasBaseCapability(membership.preset, input.capability)) {
    const baseScope = scopeForBaseCapability(input)

    if (
      scopeCoversResource({
        scope: baseScope,
        actorTeamId: input.teamId,
        selfAthleteProfileId,
        resource: input.resource,
      })
    ) {
      return { allowed: true }
    }
  }

  if (hasGrantCapability(input, selfAthleteProfileId)) {
    return { allowed: true }
  }

  return { allowed: false }
}
