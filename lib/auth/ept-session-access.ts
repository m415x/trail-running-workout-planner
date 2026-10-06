import type { ExternalIdentityLookup, EptSessionIdentity } from './server-session-identity'
import { resolveAuthenticatedEptIdentity } from './server-session-identity'
import type { SupabaseServerSessionAuth } from './supabase-server-session-state'
import { readSupabaseServerSessionState } from './supabase-server-session-state'

export type EptSessionAccessAuth = SupabaseServerSessionAuth

export type EptSessionAccessState = EptSessionIdentity

export async function readEptSessionAccessState(
  auth: EptSessionAccessAuth,
  lookup: ExternalIdentityLookup,
): Promise<EptSessionAccessState> {
  const session = await readSupabaseServerSessionState(auth)

  if (session.status === 'anonymous') {
    return { status: 'anonymous' }
  }

  if (session.status !== 'verified') {
    return { status: 'invalid' }
  }

  return resolveAuthenticatedEptIdentity(
    session.externalSubject,
    lookup,
  )
}
