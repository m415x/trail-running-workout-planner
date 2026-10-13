export interface AcceptanceAthleteBExpected {
  userId: string
  provider: 'supabase'
  subject: string
  teamId: string
  preset: 'athlete'
  profileId: string
  groupId: null
}

export interface AcceptanceAthleteBProvisioningSnapshot {
  expected: AcceptanceAthleteBExpected
  user: { id: string } | null
  link: { userId: string; provider: string; subject: string } | null
  membership: { userId: string; teamId: string; preset: string; isActive: boolean } | null
  profile: { id: string; userId: string; teamId: string; groupId: string | null } | null
}

export type AcceptanceAthleteBProvisioningStatus = 'absent' | 'complete' | 'incompatible'

/**
 * Classify the exact expected identity tuple, never identifying an actor by
 * email, display name, or other mutable administrative attributes.
 *
 * Callers must reject all incompatible states before opening a write
 * transaction. Additional rows/collisions must be checked by the repository
 * preflight before this single-actor projection can be trusted.
 */
export function classifyAcceptanceAthleteBProvisioning(
  snapshot: AcceptanceAthleteBProvisioningSnapshot,
): AcceptanceAthleteBProvisioningStatus {
  const { expected, user, link, membership, profile } = snapshot

  if (!expected.userId || !expected.subject || !expected.teamId || !expected.profileId) {
    return 'incompatible'
  }

  if (!user && !link && !membership && !profile) return 'absent'
  if (!user || !link || !membership || !profile) return 'incompatible'

  return user.id === expected.userId
    && link.userId === expected.userId
    && link.provider === expected.provider
    && link.subject === expected.subject
    && membership.userId === expected.userId
    && membership.teamId === expected.teamId
    && membership.preset === expected.preset
    && membership.isActive === true
    && profile.id === expected.profileId
    && profile.userId === expected.userId
    && profile.teamId === expected.teamId
    && profile.groupId === expected.groupId
    ? 'complete'
    : 'incompatible'
}
