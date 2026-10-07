import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'

import {
  authorizeEffectiveCapability,
  type EffectiveAuthorizationInput,
  type EffectiveAuthorizationDecision,
} from './effective-authorization'

export type AuthenticatedAuthorizationInput = Omit<
  EffectiveAuthorizationInput,
  'authenticatedUserId'
>

export function authorizeAuthenticatedCapability(
  access: RequireAuthenticatedActionResult,
  input: AuthenticatedAuthorizationInput,
): EffectiveAuthorizationDecision {
  if (access.status !== 'authenticated') {
    return { allowed: false }
  }

  return authorizeEffectiveCapability({
    ...input,
    authenticatedUserId: access.userId,
  })
}
