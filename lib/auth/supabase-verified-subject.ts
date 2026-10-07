import type { AuthenticatedExternalSubject } from './server-session-identity'

export interface SupabaseClaimsAuth {
  getClaims(): Promise<{
    data: {
      claims: {
        sub?: string | null
      }
    } | null
    error: unknown
  }>
}

export type VerifiedSupabaseSubjectResult =
  | {
      status: 'verified'
      externalSubject: AuthenticatedExternalSubject
    }
  | { status: 'invalid' }

/**
 * Converts a server-verified Supabase Auth subject into the provider/subject
 * identity consumed by the EPT session boundary.
 *
 * This boundary deliberately uses getClaims() as the verification primitive
 * and treats missing, malformed, expired, revoked, or unverifiable tokens as
 * invalid. It does not resolve ExternalIdentityLink or grant EPT access.
 */
export async function readVerifiedSupabaseSubject(
  auth: SupabaseClaimsAuth,
): Promise<VerifiedSupabaseSubjectResult> {
  try {
    const { data, error } = await auth.getClaims()

    if (error || !data) {
      return { status: 'invalid' }
    }

    const subject = data.claims.sub?.trim()

    if (!subject) {
      return { status: 'invalid' }
    }

    return {
      status: 'verified',
      externalSubject: {
        provider: 'supabase',
        subject,
      },
    }
  } catch {
    return { status: 'invalid' }
  }
}
