import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'

type Locale = 'es' | 'en'
type Result = { success: true } | { success: false; error: string }
type Charge = { monthlyChargeId: string; athleteId: string; year: number; month: number; reason: string; locale: Locale }

export function createH6EconomicExceptionActions(deps: {
  authenticate(): Promise<RequireAuthenticatedActionResult>
  authorize(access: RequireAuthenticatedActionResult, request: {
    at: string; capability: 'economy.manage'; resourceId: string
  }): Promise<{ allowed: boolean; teamId?: string }>
  ownsCharge(teamId: string, athleteId: string, chargeId: string, year: number, month: number): Promise<boolean>
  globalDueDate(teamId: string, input: { year: number; month: number; dueDate: string; reason: string }): Promise<Result>
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
    return result.allowed && result.teamId ? result.teamId : null
  }
  return {
    async global(input: { year: number; month: number; dueDate: string; reason: string; locale: Locale }): Promise<Result> {
      try {
        const teamId = await team()
        if (!teamId) return deny()
        const result = await deps.globalDueDate(teamId, input)
        if (result.success) deps.revalidate((input.locale === 'en' ? '/en' : '') + '/dashboard/membership')
        return result
      } catch { return deny() }
    },
    async reduction(input: Charge & { reductionAmountMinor: number }): Promise<Result> {
      try {
        const teamId = await team()
        if (!teamId || !await deps.ownsCharge(teamId, input.athleteId, input.monthlyChargeId, input.year, input.month)) return deny()
        const result = await deps.reduce(teamId, input)
        if (result.success) deps.revalidate(athletePath(input.locale, input.athleteId))
        return result
      } catch { return deny() }
    },
    async extension(input: Charge & { extendedDueDate: string | null }): Promise<Result> {
      try {
        const teamId = await team()
        if (!teamId || !await deps.ownsCharge(teamId, input.athleteId, input.monthlyChargeId, input.year, input.month)) return deny()
        const result = await deps.extend(teamId, input)
        if (result.success) deps.revalidate(athletePath(input.locale, input.athleteId))
        return result
      } catch { return deny() }
    },
  }
}
