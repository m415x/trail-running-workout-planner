import {
  deriveMembershipAccountState,
  deriveMonthlyChargePaymentBalance,
  explainMonthlyChargeEconomics,
} from './billing'
import type {
  BillingPersistencePort,
  GlobalDueDateExceptionPersistencePort,
  MonthlyChargeExtensionPersistencePort,
  MonthlyChargeReductionPersistencePort,
  PaymentPersistencePort,
} from './billing-persistence'
import { loadAthleteMembership } from './athlete-membership-loader'
import { createAthleteMembershipSnapshotReader } from './athlete-membership-snapshot-reader'

export function createAthleteMembershipPageLoader<TDatabase>({
  createPort,
}: {
  createPort: (db: TDatabase) =>
    BillingPersistencePort
    & Partial<GlobalDueDateExceptionPersistencePort>
    & Partial<MonthlyChargeReductionPersistencePort>
    & Partial<MonthlyChargeExtensionPersistencePort>
    & Partial<PaymentPersistencePort>
}) {
  const readSnapshot = createAthleteMembershipSnapshotReader({ createPort })

  return async function loadAthleteMembershipPage({
    db,
    locale,
    teamId,
    athleteId,
    onDate,
    cutoffDate,
  }: {
    db: TDatabase
    locale: 'es' | 'en'
    teamId: string
    athleteId: string
    onDate: string
    cutoffDate: string
  }) {
    const port = createPort(db)
    const monthlyCharges = port.listPersistedMonthlyCharges
      ? await port.listPersistedMonthlyCharges(teamId, athleteId)
      : []
    const billingTerms = monthlyCharges.length > 0
      ? await port.listBillingTerms(teamId, athleteId)
      : []
    const globalDueDateHistoryByCharge = new Map<string, Awaited<ReturnType<NonNullable<typeof port.listGlobalDueDateExceptionRevisions>>>>()

    if (port.listGlobalDueDateExceptionRevisions) {
      await Promise.all(monthlyCharges.map(async (charge) => {
        const history = await port.listGlobalDueDateExceptionRevisions!(
          teamId,
          charge.year,
          charge.month,
        )
        globalDueDateHistoryByCharge.set(charge.id, history)
      }))
    }

    const reductionHistory = port.listMonthlyChargeReductionRevisions
      ? (await Promise.all(
          monthlyCharges.map((charge) => port.listMonthlyChargeReductionRevisions!(charge.id)),
        )).flat()
      : []
    const extensionHistory = port.listMonthlyChargeExtensionRevisions
      ? (await Promise.all(
          monthlyCharges.map((charge) => port.listMonthlyChargeExtensionRevisions!(charge.id)),
        )).flat()
      : []
    const paymentHistory = port.listPaymentRevisions
      ? (await Promise.all(
          monthlyCharges.map((charge) => port.listPaymentRevisions!(charge.id)),
        )).flat()
      : []

    const membership = await loadAthleteMembership({
      locale,
      teamId,
      athleteId,
      onDate,
      getSnapshot: ({ teamId: scopedTeamId, athleteId: scopedAthleteId }) =>
        readSnapshot({
          db,
          teamId: scopedTeamId,
          athleteId: scopedAthleteId,
        }),
    })

    const accountState = deriveMembershipAccountState({
      cutoffDate,
      charges: monthlyCharges.map((charge) => ({
        id: charge.id,
        charge,
        paymentRevisions: paymentHistory.filter(
          (revision) => revision.monthlyChargeId === charge.id,
        ),
      })),
    })

    const economicHistory = monthlyCharges.flatMap((charge) => {
      const terms = billingTerms.find((item) => item.id === charge.billingTermsId)
      if (!terms) return []

      return [explainMonthlyChargeEconomics({
        teamId,
        cutoffDate,
        monthlyChargeId: charge.id,
        terms,
        charge,
        globalDueDateHistory: globalDueDateHistoryByCharge.get(charge.id) ?? [],
        reductionHistory: reductionHistory.filter(
          (revision) => revision.monthlyChargeId === charge.id,
        ),
        extensionHistory: extensionHistory.filter(
          (revision) => revision.monthlyChargeId === charge.id,
        ),
        paymentHistory: paymentHistory.filter(
          (revision) => revision.monthlyChargeId === charge.id,
        ),
      })]
    })

    return {
      ...membership,
      monthlyCharges: monthlyCharges.map((charge) => {
        const balance = deriveMonthlyChargePaymentBalance({
          charge,
          monthlyChargeId: charge.id,
          paymentRevisions: paymentHistory.filter(
            (revision) => revision.monthlyChargeId === charge.id,
          ),
        })

        return {
          id: charge.id,
          year: charge.year,
          month: charge.month,
          currency: charge.currency,
          amountDueMinor: charge.amountDueMinor,
          paidAmountMinor: balance.paidMinor,
          remainingAmountMinor: balance.remainingMinor,
        }
      }),
      accountState,
      economicHistory,
      reductionHistory,
      extensionHistory,
      paymentHistory,
    }
  }
}
