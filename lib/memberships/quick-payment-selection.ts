/**
 * Pure UI selection over an already team-scoped H4/H5 economic projection.
 * This function never materializes charges, reallocates payments or establishes authority.
 */
export type QuickPaymentCharge = {
  id: string
  year: number
  month: number
  currency: string
  remainingMinor: number
  status: 'settled' | 'pending' | 'overdue'
}

export type QuickPaymentSource =
  | { kind: 'list' }
  | { kind: 'charge'; monthlyChargeId: string }

export function selectQuickPaymentCharge<TCharge extends QuickPaymentCharge>(input: {
  charges: readonly TCharge[]
  currentPeriod: { year: number; month: number }
  source: QuickPaymentSource
  blockedForPriorDebt: boolean
}): {
  selectedChargeId: string | null
  hasPriorOverdueDebt: boolean
  eligibleChargeIds: string[]
  eligibleCharges: TCharge[]
} {
  const eligibleCharges = input.charges.filter(
    (charge) => Number.isSafeInteger(charge.remainingMinor) && charge.remainingMinor > 0,
  )

  const source = input.source
  const selectedCharge = source.kind === 'charge'
    ? eligibleCharges.find((charge) => charge.id === source.monthlyChargeId)
    : eligibleCharges.find((charge) =>
        charge.year === input.currentPeriod.year && charge.month === input.currentPeriod.month,
      )

  return {
    selectedChargeId: selectedCharge?.id ?? null,
    hasPriorOverdueDebt: input.blockedForPriorDebt,
    eligibleChargeIds: eligibleCharges.map((charge) => charge.id),
    eligibleCharges,
  }
}
