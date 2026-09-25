import type { TeamEconomicPolicyQueryRepository } from './membership-policy-query'
import { getCurrentTeamEconomicPolicy } from './membership-policy-query'
import { getMembershipPolicyViewModel } from './membership-policy-view-model'
import { getTeamEconomicPolicyFormModel } from './membership-policy-form-model'

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

  const policyViewModel = getMembershipPolicyViewModel({
    locale,
    policy,
  })

  return {
    ...policyViewModel,
    policy: policyViewModel,
    form: getTeamEconomicPolicyFormModel({
      locale,
      policy,
    }),
  }
}
