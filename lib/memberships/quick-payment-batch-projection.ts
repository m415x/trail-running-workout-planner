import {
  deriveMembershipAccountState,
  deriveMembershipDebtExperience,
} from './billing'
import type {
  MonthlyChargeCandidate,
  PaymentRevision,
} from './billing'

type PersistedCharge = MonthlyChargeCandidate & { id: string }

type ProjectedCharge = {
  id: string
  year: number
  month: number
  currency: string
  remainingMinor: number
  status: 'settled' | 'pending' | 'overdue'
}

/**
 * Derive read-only, per-athlete H4/H5 snapshots from a single already-scoped
 * batch. Repository ownership and team filtering must precede this boundary.
 */
export function projectQuickPaymentBatch(input: {
  requestedAthleteIds: readonly string[]
  cutoffDate: string
  charges: readonly PersistedCharge[]
  paymentRevisions: readonly PaymentRevision[]
}): Array<{
  athleteId: string
  charges: ProjectedCharge[]
  blockedForPriorDebt: boolean
}> {
  const requested = new Set(input.requestedAthleteIds)
  if (requested.size !== input.requestedAthleteIds.length) {
    throw new Error('Quick-payment scope includes duplicate athletes')
  }

  const chargesByAthlete = new Map<string, PersistedCharge[]>()
  const chargeIds = new Set<string>()
  for (const charge of input.charges) {
    if (!requested.has(charge.athleteId) || chargeIds.has(charge.id)) {
      throw new Error('Quick-payment charge violates requested scope')
    }
    chargeIds.add(charge.id)
    const previous = chargesByAthlete.get(charge.athleteId) ?? []
    previous.push(charge)
    chargesByAthlete.set(charge.athleteId, previous)
  }

  const revisionsByCharge = new Map<string, PaymentRevision[]>()
  for (const revision of input.paymentRevisions) {
    if (!chargeIds.has(revision.monthlyChargeId)) {
      throw new Error('Quick-payment revision violates requested charge scope')
    }
    const previous = revisionsByCharge.get(revision.monthlyChargeId) ?? []
    previous.push(revision)
    revisionsByCharge.set(revision.monthlyChargeId, previous)
  }

  return input.requestedAthleteIds.map((athleteId) => {
    const athleteCharges = chargesByAthlete.get(athleteId) ?? []
    const account = deriveMembershipAccountState({
      cutoffDate: input.cutoffDate,
      charges: athleteCharges.map((charge) => ({
        id: charge.id,
        charge,
        paymentRevisions: revisionsByCharge.get(charge.id) ?? [],
      })),
    })
    const projectedCharges = account.charges.map((charge) => {
      const source = athleteCharges.find((item) => item.id === charge.id)
      if (!source) throw new Error('Quick-payment projection lost a charge identity')
      return { ...charge, year: source.year, month: source.month }
    })
    const debt = deriveMembershipDebtExperience({
      asOfDate: input.cutoffDate,
      charges: projectedCharges,
    })

    return {
      athleteId,
      charges: projectedCharges.map(({ id, year, month, currency, remainingMinor, status }) => ({
        id, year, month, currency, remainingMinor, status,
      })),
      blockedForPriorDebt: debt.blockedForPriorDebt,
    }
  })
}
