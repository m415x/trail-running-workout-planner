import type { TeamMembershipPreset } from '@/types'

import {
  getCapabilityDefinition,
  type CapabilityKey,
} from './capability-catalog'
import type {
  AuthorizationScope,
  ExecutableAuthorizationScope,
} from './scope-resolution'

export interface DelegationAuthority {
  capability: CapabilityKey
  scope: ExecutableAuthorizationScope
  scopeTargetId?: string | null
  source: 'base' | 'grant'
}

export interface EvaluateDelegationPolicyInput {
  grantorPreset: TeamMembershipPreset
  capability: CapabilityKey
  requestedScope: AuthorizationScope
  requestedScopeTargetId?: string | null
  grantorAuthority: DelegationAuthority | null
}

export interface DelegationPolicyDecision {
  allowed: boolean
}

function hasValidTargetSemantics(
  scope: AuthorizationScope,
  targetId?: string | null,
): boolean {
  if (scope === 'assigned_athletes') return false
  if (scope === 'sporting_group') return Boolean(targetId)
  return targetId == null
}

function authorityCoversRequestedScope(
  authority: DelegationAuthority,
  requestedScope: ExecutableAuthorizationScope,
  requestedScopeTargetId?: string | null,
): boolean {
  if (authority.scope === 'team') {
    return true
  }

  if (authority.scope === 'self') {
    return requestedScope === 'self'
  }

  return requestedScope === 'sporting_group'
    && Boolean(authority.scopeTargetId)
    && authority.scopeTargetId === requestedScopeTargetId
}

export function evaluateDelegationPolicy(
  input: EvaluateDelegationPolicyInput,
): DelegationPolicyDecision {
  const definition = getCapabilityDefinition(input.capability)

  if (definition.structural || !definition.delegable) {
    return { allowed: false }
  }

  if (!hasValidTargetSemantics(input.requestedScope, input.requestedScopeTargetId)) {
    return { allowed: false }
  }

  if (input.requestedScope === 'assigned_athletes') {
    return { allowed: false }
  }

  if (input.grantorPreset === 'athlete' || input.grantorPreset === 'assistant') {
    return { allowed: false }
  }

  if (input.grantorPreset === 'admin') {
    return { allowed: true }
  }

  if (input.grantorPreset !== 'coach') {
    return { allowed: false }
  }

  const authority = input.grantorAuthority
  if (!authority || authority.source !== 'base') {
    return { allowed: false }
  }

  if (authority.capability !== input.capability) {
    return { allowed: false }
  }

  return {
    allowed: authorityCoversRequestedScope(
      authority,
      input.requestedScope,
      input.requestedScopeTargetId,
    ),
  }
}
