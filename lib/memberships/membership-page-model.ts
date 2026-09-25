import type { TeamEconomicPolicyQueryRepository } from './membership-policy-query'
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
  const policies = await repository.listTeamEconomicPolicies(teamId)
  const effective = policies.filter(
    (policy) =>
      policy.effectiveFrom <= onDate
      && (policy.effectiveUntil === null || onDate < policy.effectiveUntil),
  )

  if (effective.length > 1) {
    throw new Error('Team economic policy history is ambiguous')
  }

  const policy = effective[0] ?? null
  const next = policies
    .filter((candidate) => candidate.effectiveFrom > onDate)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0] ?? null

  const policyViewModel = getMembershipPolicyViewModel({ locale, policy })

  return {
    ...policyViewModel,
    policy: policyViewModel,
    nextPolicy: next
      ? getMembershipPolicyViewModel({ locale, policy: next })
      : null,
    form: getTeamEconomicPolicyFormModel({
      locale,
      policy,
    }),
  }
}
