import { createExternalIdentityLookup } from '@/lib/auth/external-identity-lookup'
import { readEptSessionAccessState } from '@/lib/auth/ept-session-access'
import { requireAuthenticatedEptAction } from '@/lib/auth/require-authenticated-action'
import { createSupabaseServerClient } from '@/lib/auth/supabase-server'
import { createH5aSelfNextServerContext } from '@/lib/authorization/h5a-self-next-server'

export type BiometricSelfOperation = 'read' | 'manage'
export type BiometricSelfAuthority =
  | { readonly status: 'resolved'; readonly userId: string; readonly teamId: string; readonly athleteProfileId: string }
  | { readonly status: 'denied' }

/**
 * Request-scoped authority only. No biometric repository, response disclosure
 * or mutation is exposed until T5's transactional writer/read tests pass.
 * Never accepts identity or scope from a client request.
 */
export async function resolveBiometricSelfAuthority(
  operation: BiometricSelfOperation,
): Promise<BiometricSelfAuthority> {
  if (operation !== 'read' && operation !== 'manage') return { status: 'denied' }

  try {
    const supabase = await createSupabaseServerClient()
    const lookup = createExternalIdentityLookup()
    const access = await requireAuthenticatedEptAction({
      readAccess: () => readEptSessionAccessState(supabase.auth, lookup),
    })
    if (access.status !== 'authenticated') return { status: 'denied' }

    const capability = operation === 'read'
      ? 'physiology.biometric.self.read'
      : 'physiology.biometric.self.manage'
    const self = await createH5aSelfNextServerContext().resolve(access, {
      at: new Date().toISOString(),
      capability,
    })
    if (self.status !== 'resolved') return { status: 'denied' }

    return {
      status: 'resolved',
      userId: self.userId,
      teamId: self.teamId,
      athleteProfileId: self.athleteProfileId,
    }
  } catch {
    return { status: 'denied' }
  }
}
