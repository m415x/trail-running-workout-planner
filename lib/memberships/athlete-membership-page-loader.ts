import type { BillingPersistencePort } from './billing-persistence'
import { loadAthleteMembership } from './athlete-membership-loader'
import { createAthleteMembershipSnapshotReader } from './athlete-membership-snapshot-reader'

export function createAthleteMembershipPageLoader<TDatabase>({
  createPort,
}: {
  createPort: (db: TDatabase) => BillingPersistencePort
}) {
  const readSnapshot = createAthleteMembershipSnapshotReader({ createPort })

  return async function loadAthleteMembershipPage({
    db,
    locale,
    teamId,
    athleteId,
  }: {
    db: TDatabase
    locale: 'es' | 'en'
    teamId: string
    athleteId: string
  }) {
    return loadAthleteMembership({
      locale,
      teamId,
      athleteId,
      getSnapshot: ({ teamId: scopedTeamId, athleteId: scopedAthleteId }) =>
        readSnapshot({
          db,
          teamId: scopedTeamId,
          athleteId: scopedAthleteId,
        }),
    })
  }
}
