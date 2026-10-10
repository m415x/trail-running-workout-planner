import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'

export type TrustedH7aAuthorship = Readonly<{
  authenticatedActorUserId: string
  effectiveActorUserId: string
}>

/** H7A authorship is observational: it never grants authority or impersonation. */
export function resolveTrustedH7aAuthorship(
  access: RequireAuthenticatedActionResult,
): TrustedH7aAuthorship | null {
  if (access.status !== 'authenticated') return null

  return {
    authenticatedActorUserId: access.userId,
    effectiveActorUserId: access.userId,
  }
}
