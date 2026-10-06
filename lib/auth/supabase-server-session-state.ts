import type { AuthenticatedExternalSubject } from './server-session-identity'

interface SupabaseAuthErrorLike {
  name?: unknown
  code?: unknown
  status?: unknown
}

export interface SupabaseServerSessionAuth {
  getClaims(): Promise<{
    data: {
      claims: {
        sub?: string | null
      }
    } | null
    error: unknown
  }>
  getUser(): Promise<{
    data: {
      user: {
        id?: string | null
      } | null
    } | null
    error: unknown
  }>
}

export type SupabaseServerSessionState =
  | { status: 'anonymous' }
  | { status: 'expired' }
  | { status: 'revoked' }
  | { status: 'invalid' }
  | {
      status: 'verified'
      externalSubject: AuthenticatedExternalSubject
    }

function asAuthError(error: unknown): SupabaseAuthErrorLike | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  return error as SupabaseAuthErrorLike
}

function isMissingSession(error: unknown): boolean {
  return asAuthError(error)?.name === 'AuthSessionMissingError'
}

function isExpiredSession(error: unknown): boolean {
  return asAuthError(error)?.code === 'session_expired'
}

function isRevokedSession(error: unknown): boolean {
  return asAuthError(error)?.code === 'session_not_found'
}

export async function readSupabaseServerSessionState(
  auth: SupabaseServerSessionAuth,
): Promise<SupabaseServerSessionState> {
  try {
    const claimsResult = await auth.getClaims()
    const claimsError = claimsResult.error

    if (isMissingSession(claimsError)) {
      return { status: 'anonymous' }
    }

    if (isExpiredSession(claimsError)) {
      return { status: 'expired' }
    }

    if (claimsError || !claimsResult.data) {
      return { status: 'invalid' }
    }

    const claimsSubject = claimsResult.data.claims.sub?.trim()

    if (!claimsSubject) {
      return { status: 'invalid' }
    }

    const userResult = await auth.getUser()

    if (isRevokedSession(userResult.error)) {
      return { status: 'revoked' }
    }

    if (userResult.error || !userResult.data?.user) {
      return { status: 'invalid' }
    }

    const userSubject = userResult.data.user.id?.trim()

    if (!userSubject || userSubject !== claimsSubject) {
      return { status: 'invalid' }
    }

    return {
      status: 'verified',
      externalSubject: {
        provider: 'supabase',
        subject: claimsSubject,
      },
    }
  } catch {
    return { status: 'invalid' }
  }
}
