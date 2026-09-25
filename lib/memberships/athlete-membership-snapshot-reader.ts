import { createBillingPersistenceAdapter, type BillingPersistencePort } from './billing-persistence'

export function createAthleteMembershipSnapshotReader<TDatabase>({
  createPort,
}: {
  createPort: (db: TDatabase) => BillingPersistencePort
}) {
  return async function readAthleteMembershipSnapshot({
    db,
    teamId,
    athleteId,
  }: {
    db: TDatabase
    teamId: string
    athleteId: string
  }) {
    const persistence = createBillingPersistenceAdapter(createPort(db))

    return persistence.getAthleteBillingSnapshot({
      teamId,
      athleteId,
    })
  }
}
