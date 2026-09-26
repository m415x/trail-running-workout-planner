import type {
  AthleteBillingTerms,
  MonthlyChargeCandidate,
} from './billing'
import { buildAthleteMembershipViewModel } from './athlete-membership-view-model'

type AthleteBillingSnapshot = {
  terms: AthleteBillingTerms[]
  charges: MonthlyChargeCandidate[]
}

export async function loadAthleteMembership({
  locale,
  teamId,
  athleteId,
  onDate,
  getSnapshot,
}: {
  locale: 'es' | 'en'
  teamId: string
  athleteId: string
  onDate: string
  getSnapshot: (input: {
    teamId: string
    athleteId: string
  }) => Promise<AthleteBillingSnapshot>
}) {
  const snapshot = await getSnapshot({
    teamId,
    athleteId,
  })

  return buildAthleteMembershipViewModel({
    locale,
    terms: snapshot.terms,
    charges: snapshot.charges,
    onDate,
  })
}
