import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import { resolveAuthorizedH7aWriterContext } from '@/lib/authorization/h7a-trusted-authorship'
import type { TrustedH7aAuthorship } from '@/lib/authorization/h7a-trusted-authorship'

type PolicyInput = {
  effectiveFrom: string
  defaultMonthlyAmountMinor: number
  currency: string
  ordinaryDueDay: number
}

type PolicyResult = { success: true } | { success: false; error: string }

export function createH6PolicyAction(deps: {
  authenticate(): Promise<RequireAuthenticatedActionResult>
  authorize(
    access: RequireAuthenticatedActionResult,
    request: { at: string; capability: 'economic_policy.manage'; resourceId: string },
  ): Promise<{ allowed: boolean; teamId?: string }>
  configure(teamId: string, input: PolicyInput, authorship: TrustedH7aAuthorship): Promise<PolicyResult>
  revalidate(): void
  now(): string
}) {
  return async (input: PolicyInput): Promise<PolicyResult> => {
    try {
      const access = await deps.authenticate()
      if (access.status !== 'authenticated') {
        return { success: false, error: 'Acceso no autorizado' }
      }
      const decision = await deps.authorize(access, {
        at: deps.now(),
        capability: 'economic_policy.manage',
        resourceId: '__active_team_policy__',
      })
      const writerContext = resolveAuthorizedH7aWriterContext(access, decision)
      if (!writerContext) {
        return { success: false, error: 'Acceso no autorizado' }
      }
      const result = await deps.configure(writerContext.teamId, input, writerContext.authorship)
      if (result.success) deps.revalidate()
      return result
    } catch {
      return { success: false, error: 'No se pudo configurar la política económica' }
    }
  }
}
