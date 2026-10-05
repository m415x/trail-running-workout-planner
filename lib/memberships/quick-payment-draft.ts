import { selectQuickPaymentCharge } from './quick-payment-selection'
import type { QuickPaymentCharge, QuickPaymentSource } from './quick-payment-selection'

export function prepareQuickPaymentDraft(input: {
  charges: readonly QuickPaymentCharge[]
  currentPeriod: { year: number; month: number }
  operationalDate: string
  source: QuickPaymentSource
  blockedForPriorDebt: boolean
}) {
  const selection = selectQuickPaymentCharge(input)
  const selected = input.charges.find(charge => charge.id === selection.selectedChargeId)
  return {
    monthlyChargeId: selected?.id ?? null,
    amountMinor: selected?.remainingMinor ?? null,
    currency: selected?.currency ?? null,
    paymentMethod: 'cash' as const,
    paidAt: input.operationalDate,
    hasPriorOverdueDebt: selection.hasPriorOverdueDebt,
  }
}

function isValidCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day
}

export function validateQuickPaymentDraft(input: {
  charges: readonly QuickPaymentCharge[]
  athleteId: string
  monthlyChargeId: string | null
  amountMinor: number
  paymentMethod: 'cash' | 'bank_transfer'
  paidAt: string
  locale: 'es' | 'en'
}): { ok: true; value: {
  athleteId: string
  monthlyChargeId: string
  amountMinor: number
  paymentMethod: 'cash' | 'bank_transfer'
  paidAt: string
  locale: 'es' | 'en'
} } | { ok: false; error: 'invalid_charge' | 'invalid_amount' | 'invalid_method' | 'invalid_date' | 'invalid_athlete' } {
  if (!input.athleteId.trim()) return { ok: false, error: 'invalid_athlete' }
  const charge = input.charges.find(candidate => candidate.id === input.monthlyChargeId)
  if (!charge || charge.remainingMinor <= 0) return { ok: false, error: 'invalid_charge' }
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0 || input.amountMinor > charge.remainingMinor) {
    return { ok: false, error: 'invalid_amount' }
  }
  if (input.paymentMethod !== 'cash' && input.paymentMethod !== 'bank_transfer') {
    return { ok: false, error: 'invalid_method' }
  }
  if (!isValidCivilDate(input.paidAt)) return { ok: false, error: 'invalid_date' }
  return {
    ok: true,
    value: {
      athleteId: input.athleteId,
      monthlyChargeId: charge.id,
      amountMinor: input.amountMinor,
      paymentMethod: input.paymentMethod,
      paidAt: input.paidAt,
      locale: input.locale,
    },
  }
}
