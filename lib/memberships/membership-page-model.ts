import type { TeamEconomicPolicyQueryRepository } from './membership-policy-query'
import { getCurrentTeamEconomicPolicy } from './membership-policy-query'
import { getMembershipPolicyViewModel } from './membership-policy-view-model'

export async function buildMembershipPageModel({
  locale,
  teamId,
  onDate,
  repository,
}: {
  locale: 'es' | 'en'
  teamId: string
  onDate: string
  repository: TeamEconomicPolicyQueryRepository
}) {
  const policy = await getCurrentTeamEconomicPolicy({
    teamId,
    onDate,
    repository,
  })

  return getMembershipPolicyViewModel({
    locale,
    policy,
  })
}
