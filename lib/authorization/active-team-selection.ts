export interface ActiveTeamSelectionMembership {
  userId: string
  teamId: string
  effectiveFrom: string
  effectiveUntil: string | null
  isActive: boolean
  isDeleted: boolean
}

export interface ValidateActiveTeamSelectionInput {
  userId: string
  proposedTeamId: string
  at: string
  memberships: readonly ActiveTeamSelectionMembership[]
}

export type ValidateActiveTeamSelectionResult =
  | { status: 'accepted'; teamId: string }
  | { status: 'rejected' }

export const ACTIVE_TEAM_COOKIE_NAME = 'ept_active_team'

function isApplicableMembership(
  membership: ActiveTeamSelectionMembership,
  input: ValidateActiveTeamSelectionInput,
): boolean {
  if (membership.userId !== input.userId) return false
  if (membership.teamId !== input.proposedTeamId) return false
  if (!membership.isActive || membership.isDeleted) return false
  if (input.at < membership.effectiveFrom) return false
  if (membership.effectiveUntil !== null && input.at >= membership.effectiveUntil) {
    return false
  }
  return true
}

export function validateActiveTeamSelection(
  input: ValidateActiveTeamSelectionInput,
): ValidateActiveTeamSelectionResult {
  const matches = input.memberships.filter((membership) =>
    isApplicableMembership(membership, input),
  )

  if (matches.length !== 1) {
    return { status: 'rejected' }
  }

  return {
    status: 'accepted',
    teamId: input.proposedTeamId,
  }
}

export interface ActiveTeamCookie {
  name: typeof ACTIVE_TEAM_COOKIE_NAME
  value: string
  options: {
    httpOnly: true
    sameSite: 'lax'
    path: '/'
    secure: boolean
    maxAge?: 0
  }
}

export function activeTeamCookie(
  teamId: string,
  input: { secure: boolean },
): ActiveTeamCookie {
  return {
    name: ACTIVE_TEAM_COOKIE_NAME,
    value: teamId,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: input.secure,
    },
  }
}

export function clearActiveTeamCookie(
  input: { secure: boolean },
): ActiveTeamCookie {
  return {
    name: ACTIVE_TEAM_COOKIE_NAME,
    value: '',
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: input.secure,
      maxAge: 0,
    },
  }
}
