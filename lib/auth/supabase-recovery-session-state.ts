export interface SupabaseRecoverySessionAuth {
  getClaims(): Promise<{
    data: {
      claims: {
        sub?: string | null
        amr?: Array<{
          method?: string | null
          timestamp?: number | null
        }> | null
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

export type SupabaseRecoverySessionState =
  | { status: 'verified' }
  | { status: 'invalid' }

export async function readSupabaseRecoverySessionState(
  auth: SupabaseRecoverySessionAuth,
): Promise<SupabaseRecoverySessionState> {
  try {
    const claimsResult = await auth.getClaims()

    if (claimsResult.error || !claimsResult.data) {
      return { status: 'invalid' }
    }

    const subject = claimsResult.data.claims.sub?.trim()
    const amr = claimsResult.data.claims.amr

    if (
      !subject
      || !Array.isArray(amr)
      || !amr.some((entry) => entry?.method === 'recovery')
    ) {
      return { status: 'invalid' }
    }

    const userResult = await auth.getUser()

    if (userResult.error || !userResult.data?.user) {
      return { status: 'invalid' }
    }

    const userId = userResult.data.user.id?.trim()

    if (!userId || userId !== subject) {
      return { status: 'invalid' }
    }

    return { status: 'verified' }
  } catch {
    return { status: 'invalid' }
  }
}
