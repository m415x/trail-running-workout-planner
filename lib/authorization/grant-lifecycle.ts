import type { CapabilityKey } from './capability-catalog'
import type { AuthorizationScope } from './scope-resolution'

export interface AuthorizationGrantRecord {
  id: string
  beneficiaryUserId: string
  teamId: string
  capability: CapabilityKey
  scope: AuthorizationScope
  scopeTargetId: string | null
  effectiveFrom: string
  effectiveUntil: string | null
  grantedByUserId: string
  reason: string
  revokedAt: string | null
  revokedByUserId: string | null
  revocationReason: string | null
}

function assertValidGrantLifecycle(grant: AuthorizationGrantRecord): void {
  if (grant.scope === 'assigned_athletes') {
    throw new Error('Reserved authorization scope')
  }

  if (grant.effectiveUntil !== null && grant.effectiveUntil <= grant.effectiveFrom) {
    throw new Error('Invalid authorization grant validity')
  }

  if (grant.revokedAt !== null && grant.revokedAt < grant.effectiveFrom) {
    throw new Error('Invalid authorization grant revocation')
  }

  const completeRevocation =
    grant.revokedAt !== null
    && grant.revokedByUserId !== null
    && grant.revocationReason !== null

  const noRevocation =
    grant.revokedAt === null
    && grant.revokedByUserId === null
    && grant.revocationReason === null

  if (!completeRevocation && !noRevocation) {
    throw new Error('Invalid authorization grant revocation')
  }

  if (grant.scope === 'sporting_group' && grant.scopeTargetId === null) {
    throw new Error('Invalid authorization grant scope target')
  }

  if (
    (grant.scope === 'self' || grant.scope === 'team')
    && grant.scopeTargetId !== null
  ) {
    throw new Error('Invalid authorization grant scope target')
  }
}

export function isAuthorizationGrantActive(
  grant: AuthorizationGrantRecord,
  at: string,
): boolean {
  assertValidGrantLifecycle(grant)

  if (at < grant.effectiveFrom) return false
  if (grant.effectiveUntil !== null && at >= grant.effectiveUntil) return false
  if (grant.revokedAt !== null && at >= grant.revokedAt) return false

  return true
}
