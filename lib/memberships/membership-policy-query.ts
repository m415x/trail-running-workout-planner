import type { TeamEconomicPolicy } from './billing'

export type TeamEconomicPolicyQueryRepository = {
  listTeamEconomicPolicies: (teamId: string) => Promise<TeamEconomicPolicy[]>
}

function isEffectiveOn(policy: TeamEconomicPolicy, onDate: string) {
  return (
    policy.effectiveFrom <= onDate
    && (policy.effectiveUntil == null || onDate < policy.effectiveUntil)
  )
}

export async function getCurrentTeamEconomicPolicy({
  teamId,
  onDate,
  repository,
}: {
  teamId: string
  onDate: string
  repository: TeamEconomicPolicyQueryRepository
}) {
  const policies = await repository.listTeamEconomicPolicies(teamId)
  const effective = policies.filter((policy) => isEffectiveOn(policy, onDate))

  if (effective.length > 1) {
    throw new Error('Team economic policy is ambiguous for requested date')
  }

  return effective[0] ?? null
}
