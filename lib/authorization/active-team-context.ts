export interface ActiveTeamMembership {
  teamId: string
  isActive: boolean
  isDeleted: boolean
  effectiveFrom: string
  effectiveUntil: string | null
}

export type ActiveTeamContextResult =
  | {
      status: 'resolved'
      teamId: string
      source: 'persisted' | 'single_membership'
    }
  | {
      status: 'selection_required'
    }
  | {
      status: 'invalid_context'
    }

export interface ResolveActiveTeamContextInput {
  persistedTeamId: string | null
  memberships: readonly ActiveTeamMembership[]
  onDate: string
}

function isApplicableMembership(
  membership: ActiveTeamMembership,
  onDate: string,
): boolean {
  return (
    membership.isActive
    && !membership.isDeleted
    && membership.effectiveFrom <= onDate
    && (membership.effectiveUntil === null || membership.effectiveUntil > onDate)
  )
}

export function resolveActiveTeamContext(
  input: ResolveActiveTeamContextInput,
): ActiveTeamContextResult {
  const applicable = input.memberships.filter((membership) =>
    isApplicableMembership(membership, input.onDate),
  )

  if (input.persistedTeamId !== null) {
    const matches = applicable.filter(
      (membership) => membership.teamId === input.persistedTeamId,
    )

    if (matches.length !== 1) {
      return { status: 'invalid_context' }
    }

    return {
      status: 'resolved',
      teamId: input.persistedTeamId,
      source: 'persisted',
    }
  }

  if (applicable.length === 0) {
    return { status: 'invalid_context' }
  }

  if (applicable.length > 1) {
    return { status: 'selection_required' }
  }

  return {
    status: 'resolved',
    teamId: applicable[0]!.teamId,
    source: 'single_membership',
  }
}
