export const EXECUTABLE_AUTHORIZATION_SCOPES = [
  'self',
  'sporting_group',
  'team',
] as const

export const RESERVED_AUTHORIZATION_SCOPES = [
  'assigned_athletes',
] as const

export type ExecutableAuthorizationScope =
  typeof EXECUTABLE_AUTHORIZATION_SCOPES[number]

export type ReservedAuthorizationScope =
  typeof RESERVED_AUTHORIZATION_SCOPES[number]

export type AuthorizationScope =
  | ExecutableAuthorizationScope
  | ReservedAuthorizationScope

export interface AthleteProfileLink {
  id: string
  userId: string | null
  teamId: string
}

export interface ResolveSelfAthleteProfileInput {
  userId: string
  teamId: string
}

export function resolveSelfAthleteProfile(
  profiles: readonly AthleteProfileLink[],
  input: ResolveSelfAthleteProfileInput,
): string | null {
  const matches = profiles.filter(
    (profile) => profile.userId === input.userId && profile.teamId === input.teamId,
  )

  if (matches.length === 0) return null
  if (matches.length > 1) {
    throw new Error('Conflicting AthleteProfile records')
  }

  return matches[0]?.id ?? null
}

export interface ScopedResourceIdentity {
  teamId: string
  athleteProfileId?: string | null
  sportingGroupId?: string | null
}

export interface ScopeCoverageInput {
  scope: AuthorizationScope
  actorTeamId: string
  selfAthleteProfileId?: string | null
  scopeTargetId?: string | null
  resource: ScopedResourceIdentity
}

export function scopeCoversResource(input: ScopeCoverageInput): boolean {
  if (input.resource.teamId !== input.actorTeamId) {
    return false
  }

  if (input.scope === 'assigned_athletes') {
    return false
  }

  if (input.scope === 'team') {
    return true
  }

  if (input.scope === 'self') {
    return Boolean(
      input.selfAthleteProfileId
      && input.resource.athleteProfileId
      && input.selfAthleteProfileId === input.resource.athleteProfileId,
    )
  }

  return Boolean(
    input.scopeTargetId
    && input.resource.sportingGroupId
    && input.scopeTargetId === input.resource.sportingGroupId,
  )
}
