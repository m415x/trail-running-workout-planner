import {
  createTeamEconomicPolicy,
  replaceTeamEconomicPolicy,
  type TeamEconomicPolicy,
} from './billing'

export type BillingCoachRepository = {
  listTeamEconomicPolicies: (teamId: string) => Promise<TeamEconomicPolicy[]>
  saveTeamEconomicPolicy: (policy: TeamEconomicPolicy) => Promise<void>
  replaceTeamEconomicPolicy: (
    current: TeamEconomicPolicy,
    replacement: TeamEconomicPolicy,
  ) => Promise<void>
}

export function createBillingCoachService(repository: BillingCoachRepository) {
  return {
    async configureTeamEconomicPolicy(input: {
      teamId: string
      policyId: string
      effectiveFrom: string
      defaultMonthlyAmountMinor: number
      currency: string
      ordinaryDueDay: number
    }) {
      const policies = await repository.listTeamEconomicPolicies(input.teamId)
      const openPolicies = policies.filter((policy) => policy.effectiveUntil === null)

      if (openPolicies.length > 1) {
        throw new Error('Team economic policy history is ambiguous')
      }

      const current = openPolicies[0]

      if (!current) {
        const policy = createTeamEconomicPolicy({
          id: input.policyId,
          teamId: input.teamId,
          defaultMonthlyAmountMinor: input.defaultMonthlyAmountMinor,
          currency: input.currency,
          ordinaryDueDay: input.ordinaryDueDay,
          effectiveFrom: input.effectiveFrom,
        })

        await repository.saveTeamEconomicPolicy(policy)
        return policy
      }

      const { current: closed, replacement } = replaceTeamEconomicPolicy({
        current,
        replacementId: input.policyId,
        effectiveFrom: input.effectiveFrom,
        defaultMonthlyAmountMinor: input.defaultMonthlyAmountMinor,
        currency: input.currency,
        ordinaryDueDay: input.ordinaryDueDay,
      })

      await repository.replaceTeamEconomicPolicy(closed, replacement)
      return replacement
    },
  }
}


export type SynchronousBillingCoachRepository = {
  listTeamEconomicPolicies: (teamId: string) => TeamEconomicPolicy[]
  saveTeamEconomicPolicy: (policy: TeamEconomicPolicy) => void
  replaceTeamEconomicPolicy: (
    current: TeamEconomicPolicy,
    replacement: TeamEconomicPolicy,
  ) => void
}

export function createSynchronousBillingCoachService(
  repository: SynchronousBillingCoachRepository,
) {
  return {
    configureTeamEconomicPolicy(input: {
      teamId: string
      policyId: string
      effectiveFrom: string
      defaultMonthlyAmountMinor: number
      currency: string
      ordinaryDueDay: number
    }) {
      const policies = repository.listTeamEconomicPolicies(input.teamId)
      const openPolicies = policies.filter((policy) => policy.effectiveUntil === null)

      if (openPolicies.length > 1) {
        throw new Error('Team economic policy history is ambiguous')
      }

      const current = openPolicies[0]

      if (!current) {
        const policy = createTeamEconomicPolicy({
          id: input.policyId,
          teamId: input.teamId,
          defaultMonthlyAmountMinor: input.defaultMonthlyAmountMinor,
          currency: input.currency,
          ordinaryDueDay: input.ordinaryDueDay,
          effectiveFrom: input.effectiveFrom,
        })

        repository.saveTeamEconomicPolicy(policy)
        return policy
      }

      const { current: closed, replacement } = replaceTeamEconomicPolicy({
        current,
        replacementId: input.policyId,
        effectiveFrom: input.effectiveFrom,
        defaultMonthlyAmountMinor: input.defaultMonthlyAmountMinor,
        currency: input.currency,
        ordinaryDueDay: input.ordinaryDueDay,
      })

      repository.replaceTeamEconomicPolicy(closed, replacement)
      return replacement
    },
  }
}
