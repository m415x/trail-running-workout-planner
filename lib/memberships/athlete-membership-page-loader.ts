import type {
  BillingPersistencePort,
  MonthlyChargeExtensionPersistencePort,
  MonthlyChargeReductionPersistencePort,
} from './billing-persistence'
import { loadAthleteMembership } from './athlete-membership-loader'
import { createAthleteMembershipSnapshotReader } from './athlete-membership-snapshot-reader'

export function createAthleteMembershipPageLoader<TDatabase>({
  createPort,
}: {
  createPort: (db: TDatabase) =>
    BillingPersistencePort
    & MonthlyChargeReductionPersistencePort
    & MonthlyChargeExtensionPersistencePort
}) {
  const readSnapshot = createAthleteMembershipSnapshotReader({ createPort })

  return async function loadAthleteMembershipPage({
    db,
    locale,
    teamId,
    athleteId,
    onDate,
  }: {
    db: TDatabase
    locale: 'es' | 'en'
    teamId: string
    athleteId: string
    onDate: string
  }) {
    const port = createPort(db)
    const monthlyCharges = await port.listMonthlyCharges(teamId, athleteId)
    const reductionHistory = (await Promise.all(
      monthlyCharges.map((charge) => port.listMonthlyChargeReductionRevisions(charge.id)),
    )).flat()
    const extensionHistory = (await Promise.all(
      monthlyCharges.map((charge) => port.listMonthlyChargeExtensionRevisions(charge.id)),
    )).flat()

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

    return {
      ...membership,
      monthlyCharges: monthlyCharges.map((charge) => ({
        id: charge.id,
        year: charge.year,
        month: charge.month,
        currency: charge.currency,
        amountDueMinor: charge.amountDueMinor,
      })),
      reductionHistory,
      extensionHistory,
    }
  }
}
