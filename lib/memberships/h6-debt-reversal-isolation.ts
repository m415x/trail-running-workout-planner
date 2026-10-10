import type { H6DebtCharge } from './h6-prior-debt-self-guard'

type Charge = {
  id: string
  athleteProfileId: string
  teamId: string
  year: number
  month: number
  amountDueMinor: number
  effectiveDueDate: string
}
type Revision = {
  paymentId: string
  monthlyChargeId: string
  amountMinor: number
  voided: boolean
  isCurrent: boolean
}

export function projectH6TeamDebtSnapshot(input: {
  teamId: string
  athleteProfileId: string
  charges: readonly Charge[]
  revisions: readonly Revision[]
}): H6DebtCharge[] | null {
  if (!input.teamId || !input.athleteProfileId) return null
  const charges = input.charges.filter((charge) =>
    charge.teamId === input.teamId && charge.athleteProfileId === input.athleteProfileId,
  )
  if (charges.length === 0 && input.charges.length > 0) return null
  const chargeIds = new Set<string>()
  for (const charge of charges) {
    if (!charge.id || chargeIds.has(charge.id) ||
      !Number.isSafeInteger(charge.amountDueMinor) || charge.amountDueMinor < 0) return null
    chargeIds.add(charge.id)
  }

  const totals = new Map<string, number>()
  const paymentIds = new Set<string>()
  for (const revision of input.revisions) {
    if (!revision.isCurrent || !chargeIds.has(revision.monthlyChargeId)) continue
    if (!revision.paymentId || paymentIds.has(revision.paymentId) ||
      !Number.isSafeInteger(revision.amountMinor) || revision.amountMinor <= 0) return null
    paymentIds.add(revision.paymentId)
    if (!revision.voided) {
      const total = (totals.get(revision.monthlyChargeId) ?? 0) + revision.amountMinor
      if (!Number.isSafeInteger(total)) return null
      totals.set(revision.monthlyChargeId, total)
    }
  }
  const snapshot: H6DebtCharge[] = []
  for (const charge of charges) {
    const remainingMinor = charge.amountDueMinor - (totals.get(charge.id) ?? 0)
    if (!Number.isSafeInteger(remainingMinor) || remainingMinor < 0) return null
    snapshot.push({
      year: charge.year,
      month: charge.month,
      remainingMinor,
      effectiveDueDate: charge.effectiveDueDate,
    })
  }
  return snapshot
}
