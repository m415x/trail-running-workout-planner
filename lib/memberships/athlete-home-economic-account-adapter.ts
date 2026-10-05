import {
  deriveMembershipAccountState,
  deriveMembershipDebtExperience,
  type MonthlyChargeCandidate,
  type PaymentRevision,
} from './billing'
import type { AthleteHomeEconomicAccount, AthleteHomeEconomicReadInput } from './athlete-home-economic-reader'

type ScopedCharge = Pick<MonthlyChargeCandidate,
  'athleteId' | 'billingTermsId' | 'year' | 'month' | 'amountDueMinor'
  | 'currency' | 'baseDueDate' | 'effectiveDueDate'
> & { id: string; baseAmountMinor?: number }

type EconomicPort = {
  athleteBelongsToTeam: (teamId: string, athleteId: string) => Promise<boolean>
  listBillingTerms: (teamId: string, athleteId: string) => Promise<readonly { id: string }[]>
  listPersistedMonthlyCharges: (teamId: string, athleteId: string) => Promise<readonly ScopedCharge[]>
  listPaymentRevisionsForCharges?: (chargeIds: readonly string[]) => Promise<PaymentRevision[]>
}

/**
 * Read-only adapter. All scoped reads occur only after team membership is verified.
 * H4/H5 remain the exclusive source for status and prior-debt semantics.
 */
export function createAthleteHomeEconomicAccountAdapter({
  createPort,
}: {
  createPort: () => EconomicPort
}) {
  return async ({ teamId, athleteId, cutoffDate }: AthleteHomeEconomicReadInput): Promise<AthleteHomeEconomicAccount> => {
    const port = createPort()
    if (!(await port.athleteBelongsToTeam(teamId, athleteId))) {
      throw new Error('Athlete is outside the requested team')
    }

    const terms = await port.listBillingTerms(teamId, athleteId)
    if (terms.length === 0) {
      return { available: false, blockedForPriorDebt: false, charges: [] }
    }

    const charges = await port.listPersistedMonthlyCharges(teamId, athleteId)
    if (charges.length === 0) {
      return { available: false, blockedForPriorDebt: false, charges: [] }
    }

    const termIds = new Set(terms.map(term => term.id))
    if (charges.some(charge =>
      charge.athleteId !== athleteId || !termIds.has(charge.billingTermsId)
    )) {
      throw new Error('Monthly charges are outside the requested economic scope')
    }

    if (!port.listPaymentRevisionsForCharges) {
      throw new Error('Athlete Home requires batch Payment reads')
    }

    const allowedChargeIds = new Set(charges.map(charge => charge.id))
    const batched = await port.listPaymentRevisionsForCharges(charges.map(charge => charge.id))
    if (batched.some(revision => !allowedChargeIds.has(revision.monthlyChargeId))) {
      throw new Error('Payment revision is outside requested charge scope')
    }
    const entries = charges.map(charge => ({
      id: charge.id,
      charge: charge as MonthlyChargeCandidate,
      paymentRevisions: batched.filter(revision => revision.monthlyChargeId === charge.id),
    }))
    const account = deriveMembershipAccountState({ cutoffDate, charges: entries })
    const periodById = new Map(charges.map(charge => [charge.id, charge]))
    const debt = deriveMembershipDebtExperience({
      asOfDate: cutoffDate,
      charges: account.charges.map(charge => {
        const period = periodById.get(charge.id)
        if (!period) throw new Error('Missing MonthlyCharge period')
        return { ...charge, year: period.year, month: period.month }
      }),
    })

    return {
      available: true,
      blockedForPriorDebt: debt.blockedForPriorDebt,
      charges: debt.charges.map(({ year, month, status, remainingMinor }) => ({
        year, month, status, remainingMinor,
      })),
    }
  }
}
