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

export type AuthorizedH7aWriterContext = Readonly<{
  teamId: string
  authorship: TrustedH7aAuthorship
}>

/** Accept only the server-side H3 authorization decision as the Team authority. */
export function resolveAuthorizedH7aWriterContext(
  access: RequireAuthenticatedActionResult,
  decision: Readonly<{ allowed: boolean; teamId?: string }>,
): AuthorizedH7aWriterContext | null {
  const authorship = resolveTrustedH7aAuthorship(access)
  if (!authorship || !decision.allowed || !decision.teamId) return null
  return { teamId: decision.teamId, authorship }
}
