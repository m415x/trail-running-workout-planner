import type { ExternalIdentityLookup } from './server-session-identity'
import { resolveAuthenticatedEptIdentity } from './server-session-identity'
import { resolveSafeAuthReturnPath, type SupportedAuthLocale } from './safe-return-path'
import { readSupabaseServerSessionState } from './supabase-server-session-state'

export interface SupabasePasswordLoginAuth {
  signInWithPassword(credentials: {
    email: string
    password: string
  }): Promise<{
    data: {
      session: {
        access_token?: string | null
      } | null
    }
    error: unknown
  }>
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
  signOut(): Promise<{ error: unknown }>
}

export type EptLoginResult =
  | {
      status: 'authenticated'
      userId: string
      returnTo: string
    }
  | { status: 'unlinked' }
  | { status: 'invalid_credentials' }
  | { status: 'invalid' }

export async function authenticateEptLogin(input: {
  auth: SupabasePasswordLoginAuth
  lookup: ExternalIdentityLookup
  email: string
  password: string
  locale: SupportedAuthLocale
  returnTo?: string | null
}): Promise<EptLoginResult> {
  const email = input.email.trim()

  try {
    const login = await input.auth.signInWithPassword({
      email,
      password: input.password,
    })

    if (login.error || !login.data.session) {
      return { status: 'invalid_credentials' }
    }

    const session = await readSupabaseServerSessionState(input.auth)

    if (session.status !== 'verified') {
      await input.auth.signOut()
      return { status: 'invalid' }
    }

    const identity = await resolveAuthenticatedEptIdentity(
      session.externalSubject,
      input.lookup,
    )

    if (identity.status === 'unlinked') {
      await input.auth.signOut()
      return { status: 'unlinked' }
    }

    if (identity.status !== 'authenticated') {
      await input.auth.signOut()
      return { status: 'invalid' }
    }

    return {
      status: 'authenticated',
      userId: identity.userId,
      returnTo: resolveSafeAuthReturnPath(input.returnTo, input.locale),
    }
  } catch {
    try {
      await input.auth.signOut()
    } catch {
      // Authentication failures remain fail-closed even if cleanup also fails.
    }

    return { status: 'invalid' }
  }
}
