import {
  classifyAcceptanceAthleteBProvisioning,
  type AcceptanceAthleteBExpected,
  type AcceptanceAthleteBProvisioningStatus,
} from '@/lib/acceptance/athlete-b-provisioning-contract'

type User = { id: string }
type Link = { userId: string; provider: string; subject: string }
type Membership = { userId: string; teamId: string; preset: string; isActive: boolean }
type Profile = { id: string; userId: string; teamId: string; groupId: string | null }

export interface AcceptanceAthleteBIdentityPreflight {
  expected: AcceptanceAthleteBExpected
  usersById: User[]
  linksBySubject: Link[]
  linksByUserId: Link[]
  membershipsByUserId: Membership[]
  profilesByUserId: Profile[]
}

export interface AcceptanceAthleteBIdentityInspection {
  status: AcceptanceAthleteBProvisioningStatus
}

/**
 * Pure, fail-closed check for the exact identity tuple. Repository callers
 * must provide exhaustive rows for each lookup, including soft-deleted rows;
 * the check never infers identity from name or email.
 */
export function inspectAcceptanceAthleteBIdentity(
  input: AcceptanceAthleteBIdentityPreflight,
): AcceptanceAthleteBIdentityInspection {
  const { expected } = input
  if (!expected.subject.trim()
    || !expected.userId.trim()
    || !expected.profileId.trim()
    || expected.provider !== 'supabase'
    || expected.teamId !== 'team_1'
    || expected.preset !== 'athlete'
    || expected.groupId !== null
    || expected.userId === 'accept_h4b_athlete') {
    return { status: 'incompatible' }
  }

  const {
    usersById, linksBySubject, linksByUserId,
    membershipsByUserId, profilesByUserId,
  } = input

  if (usersById.length > 1 || linksBySubject.length > 1
    || linksByUserId.length > 1 || membershipsByUserId.length > 1
    || profilesByUserId.length > 1) {
    return { status: 'incompatible' }
  }

  const user = usersById[0] ?? null
  const link = linksBySubject[0] ?? null
  const userLink = linksByUserId[0] ?? null
  const membership = membershipsByUserId[0] ?? null
  const profile = profilesByUserId[0] ?? null

  if ((link && (!userLink || link.provider !== userLink.provider
    || link.subject !== userLink.subject || link.userId !== userLink.userId))
    || (!link && userLink)) {
    return { status: 'incompatible' }
  }

  return {
    status: classifyAcceptanceAthleteBProvisioning({
      expected, user, link, membership, profile,
    }),
  }
}
