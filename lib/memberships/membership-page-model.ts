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
  const [policies, globalDueDateExceptionHistory] = await Promise.all([
    repository.listTeamEconomicPolicies(teamId),
    repository.listGlobalDueDateExceptionRevisions(teamId),
  ])
  const effective = policies.filter(
    (policy) =>
      policy.effectiveFrom <= onDate
      && (policy.effectiveUntil === null || onDate < policy.effectiveUntil),
  )

  if (effective.length > 1) {
    throw new Error('Team economic policy history is ambiguous')
  }

  const current = effective[0] ?? null
  const scheduled = policies
    .filter((policy) => policy.effectiveFrom > onDate)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  const past = policies
    .filter(
      (policy) =>
        policy.effectiveUntil !== null
        && policy.effectiveUntil <= onDate,
    )
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))

  const policyViewModel = getMembershipPolicyViewModel({
    locale,
    policy: current,
  })
  const scheduledPolicies = scheduled.map((policy) =>
    getMembershipPolicyViewModel({ locale, policy }),
  )
  const pastPolicies = past.map((policy) =>
    getMembershipPolicyViewModel({ locale, policy }),
  )
  const formBasePolicy = scheduled.at(-1) ?? current

  return {
    ...policyViewModel,
    policy: policyViewModel,
    currentPolicy: policyViewModel,
    nextPolicy: scheduledPolicies[0] ?? null,
    scheduledPolicies,
    pastPolicies,
    globalDueDateExceptionHistory,
    form: getTeamEconomicPolicyFormModel({
      locale,
      policy: formBasePolicy,
    }),
  }
}
