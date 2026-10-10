import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'
import { resolveAuthorizedH7aWriterContext, type TrustedH7aAuthorship } from '@/lib/authorization/h7a-trusted-authorship'

type Locale = 'es' | 'en'
type Result = { success: true } | { success: false; error: string }
type Charge = { monthlyChargeId: string; athleteId: string; year: number; month: number; reason: string; locale: Locale }

export function createH6EconomicExceptionActions(deps: {
  authenticate(): Promise<RequireAuthenticatedActionResult>
  authorize(access: RequireAuthenticatedActionResult, request: {
    at: string; capability: 'economy.manage'; resourceId: string
  }): Promise<{ allowed: boolean; teamId?: string }>
  ownsCharge(teamId: string, athleteId: string, chargeId: string, year: number, month: number): Promise<boolean>
  globalDueDate(teamId: string, input: { year: number; month: number; dueDate: string; reason: string }, authorship: TrustedH7aAuthorship): Promise<Result>
  reduce(teamId: string, input: Charge & { reductionAmountMinor: number }): Promise<Result>
  extend(teamId: string, input: Charge & { extendedDueDate: string | null }): Promise<Result>
  revalidate(path: string): void
  now(): string
}) {
  const deny = (): Result => ({ success: false, error: 'Acceso no autorizado' })
  const athletePath = (locale: Locale, athleteId: string) => (locale === 'en' ? '/en' : '') + '/dashboard/athletes/' + athleteId
  async function team() {
    const access = await deps.authenticate()
    if (access.status !== 'authenticated') return null
    const result = await deps.authorize(access, {
      at: deps.now(), capability: 'economy.manage', resourceId: '__active_team_economy__',
    })
    return resolveAuthorizedH7aWriterContext(access, result)
  }
  return {
    async global(input: { year: number; month: number; dueDate: string; reason: string; locale: Locale }): Promise<Result> {
      try {
        const context = await team()
        if (!context) return deny()
        const result = await deps.globalDueDate(context.teamId, input, context.authorship)
        if (result.success) deps.revalidate((input.locale === 'en' ? '/en' : '') + '/dashboard/membership')
        return result
      } catch { return deny() }
    },
    async reduction(input: Charge & { reductionAmountMinor: number }): Promise<Result> {
      try {
        const context = await team()
        if (!context || !await deps.ownsCharge(context.teamId, input.athleteId, input.monthlyChargeId, input.year, input.month)) return deny()
        const result = await deps.reduce(context.teamId, input)
        if (result.success) deps.revalidate(athletePath(input.locale, input.athleteId))
        return result
      } catch { return deny() }
    },
    async extension(input: Charge & { extendedDueDate: string | null }): Promise<Result> {
      try {
        const context = await team()
        if (!context || !await deps.ownsCharge(context.teamId, input.athleteId, input.monthlyChargeId, input.year, input.month)) return deny()
        const result = await deps.extend(context.teamId, input)
        if (result.success) deps.revalidate(athletePath(input.locale, input.athleteId))
        return result
      } catch { return deny() }
    },
  }
}
