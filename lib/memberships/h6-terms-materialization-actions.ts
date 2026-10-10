import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'

type Locale = 'es' | 'en'
type MutationResult = { success: true } | { success: false; error: string }
type BulkResult = { success: true; processedAthletes: number; materializedCharges: number } | { success: false; error: string }

export function createH6TermsAndMaterializationActions(deps: {
  authenticate(): Promise<RequireAuthenticatedActionResult>
  authorize(access: RequireAuthenticatedActionResult, request: {
    at: string; capability: 'economy.manage'; resourceId: string
  }): Promise<{ allowed: boolean; teamId?: string }>
  ownsAthlete(teamId: string, athleteId: string): Promise<boolean>
  initializeTerms(teamId: string, athleteId: string, effectiveFrom: string): Promise<MutationResult>
  changeTerms(teamId: string, athleteId: string, input: {
    effectiveFrom: string; monthlyAmountMinor: number; currency: string
  }): Promise<MutationResult>
  materialize(teamId: string, input: { year: number; month: number }): Promise<BulkResult>
  revalidate(path: string): void
  now(): string
}) {
  async function authorize(resourceId: string) {
    const access = await deps.authenticate()
    if (access.status !== 'authenticated') return null
    const result = await deps.authorize(access, {
      at: deps.now(), capability: 'economy.manage', resourceId,
    })
    return result.allowed && result.teamId ? result.teamId : null
  }
  const deny = (): MutationResult => ({ success: false, error: 'Acceso no autorizado' })
  const athletePath = (locale: Locale, id: string) =>
    (locale === 'en' ? '/en' : '') + '/dashboard/athletes/' + id
  return {
    async applyInitial(input: { athleteId: string; effectiveFrom: string; locale: Locale }): Promise<MutationResult> {
      try {
        const teamId = await authorize('__active_team_economy__')
        if (!teamId || !await deps.ownsAthlete(teamId, input.athleteId)) return deny()
        const result = await deps.initializeTerms(teamId, input.athleteId, input.effectiveFrom)
        if (result.success) deps.revalidate(athletePath(input.locale, input.athleteId))
        return result
      } catch { return deny() }
    },
    async change(input: { athleteId: string; effectiveFrom: string; monthlyAmountMinor: number; currency: string; locale: Locale }): Promise<MutationResult> {
      try {
        const teamId = await authorize('__active_team_economy__')
        if (!teamId || !await deps.ownsAthlete(teamId, input.athleteId)) return deny()
        const result = await deps.changeTerms(teamId, input.athleteId, {
          effectiveFrom: input.effectiveFrom, monthlyAmountMinor: input.monthlyAmountMinor, currency: input.currency,
        })
        if (result.success) deps.revalidate(athletePath(input.locale, input.athleteId))
        return result
      } catch { return deny() }
    },
    async materialize(input: { year: number; month: number; locale: Locale }): Promise<BulkResult> {
      try {
        const teamId = await authorize('__active_team_economy__')
        if (!teamId) return { success: false, error: 'Acceso no autorizado' }
        const result = await deps.materialize(teamId, { year: input.year, month: input.month })
        if (result.success) deps.revalidate((input.locale === 'en' ? '/en' : '') + '/dashboard/membership')
        return result
      } catch { return { success: false, error: 'Acceso no autorizado' } }
    },
  }
}
