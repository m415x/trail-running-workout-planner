import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'

type Locale = 'es' | 'en'
type PaymentBase = { athleteId: string; monthlyChargeId: string; locale: Locale }
type Register = PaymentBase & { amountMinor: number; paymentMethod: 'cash' | 'bank_transfer'; paidAt: string }
type Correct = Register & { paymentId: string }
type Void = PaymentBase & { paymentId: string }
type Result = { success: true } | { success: false; error: string }

export function createH6PaymentActions(deps: {
  authenticate(): Promise<RequireAuthenticatedActionResult>
  authorize(access: RequireAuthenticatedActionResult, request: { at: string; capability: 'economy.manage'; resourceId: string }): Promise<{ allowed: boolean; teamId?: string }>
  ownsCharge(teamId: string, athleteId: string, chargeId: string): Promise<boolean>
  ownsPayment(teamId: string, athleteId: string, chargeId: string, paymentId: string): Promise<boolean>
  register(teamId: string, input: Register): Promise<Result>
  correct(teamId: string, input: Correct): Promise<Result>
  voidPayment(teamId: string, input: Void): Promise<Result>
  revalidate(path: string): void
  now(): string
}) {
  const deny = (): Result => ({ success: false, error: 'Acceso no autorizado' })
  async function checkedTeam(input: PaymentBase, paymentId?: string): Promise<string | null> {
    const actor = await deps.authenticate()
    if (actor.status !== 'authenticated') return null
    const decision = await deps.authorize(actor, { at: deps.now(), capability: 'economy.manage', resourceId: '__active_team_economy__' })
    if (!decision.allowed || !decision.teamId) return null
    if (!await deps.ownsCharge(decision.teamId, input.athleteId, input.monthlyChargeId)) return null
    if (paymentId && !await deps.ownsPayment(decision.teamId, input.athleteId, input.monthlyChargeId, paymentId)) return null
    return decision.teamId
  }
  async function execute<T extends PaymentBase>(input: T, write: (teamId: string, data: T) => Promise<Result>, paymentId?: string): Promise<Result> {
    try {
      const team = await checkedTeam(input, paymentId)
      if (!team) return deny()
      const result = await write(team, input)
      if (result.success) deps.revalidate((input.locale === 'en' ? '/en' : '') + '/dashboard/athletes/' + input.athleteId)
      return result
    } catch { return deny() }
  }
  return {
    register: (input: Register) => execute(input, deps.register),
    correct: (input: Correct) => execute(input, deps.correct, input.paymentId),
    voidPayment: (input: Void) => execute(input, deps.voidPayment, input.paymentId),
  }
}
