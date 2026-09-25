import {
  applyAthleteBillingTerms,
  changeAthleteBillingTerms,
  type AthleteBillingTerms,
  type TeamEconomicPolicy,
} from './billing'

export type AthleteBillingTermsRepository = {
  athleteBelongsToTeam: (teamId: string, athleteId: string) => Promise<boolean>
  listTeamEconomicPolicies: (teamId: string) => Promise<TeamEconomicPolicy[]>
  listAthleteBillingTerms: (
    teamId: string,
    athleteId: string,
  ) => Promise<AthleteBillingTerms[]>
  saveAthleteBillingTerms: (terms: AthleteBillingTerms) => Promise<void>
  replaceAthleteBillingTerms: (
    current: AthleteBillingTerms,
    replacement: AthleteBillingTerms,
  ) => Promise<void>
}

function effectivePolicyAt(
  policies: TeamEconomicPolicy[],
  date: string,
): TeamEconomicPolicy {
  const matching = policies.filter((policy) =>
    policy.effectiveFrom <= date
    && (policy.effectiveUntil === null || policy.effectiveUntil > date),
  )

  if (matching.length !== 1) {
    throw new Error(
      matching.length === 0
        ? 'No team economic policy is effective for the requested date'
        : 'Team economic policy is ambiguous for the requested date',
    )
  }

  return matching[0]!
}

async function assertAthleteScope(
  repository: AthleteBillingTermsRepository,
  teamId: string,
  athleteId: string,
) {
  if (!(await repository.athleteBelongsToTeam(teamId, athleteId))) {
    throw new Error('Athlete does not belong to the requested team')
  }
}

export function createAthleteBillingTermsService(
  repository: AthleteBillingTermsRepository,
) {
  return {
    async applyInitialTerms(input: {
      teamId: string
      athleteId: string
      termsId: string
      effectiveFrom: string
    }) {
      await assertAthleteScope(repository, input.teamId, input.athleteId)

      const existing = await repository.listAthleteBillingTerms(
        input.teamId,
        input.athleteId,
      )

      if (existing.length > 0) {
        throw new Error('Athlete billing terms already exist')
      }

      const policies = await repository.listTeamEconomicPolicies(input.teamId)
      const policy = effectivePolicyAt(policies, input.effectiveFrom)
      const terms = applyAthleteBillingTerms({
        id: input.termsId,
        athleteId: input.athleteId,
        policy,
        effectiveFrom: input.effectiveFrom,
      })

      await repository.saveAthleteBillingTerms(terms)
      return terms
    },

    async changeTerms(input: {
      teamId: string
      athleteId: string
      termsId: string
      effectiveFrom: string
      monthlyAmountMinor: number
      currency: string
    }) {
      await assertAthleteScope(repository, input.teamId, input.athleteId)

      const terms = await repository.listAthleteBillingTerms(
        input.teamId,
        input.athleteId,
      )
      const openTerms = terms.filter((item) => item.effectiveUntil === null)

      if (openTerms.length !== 1) {
        throw new Error(
          openTerms.length === 0
            ? 'No open athlete billing terms found'
            : 'Athlete billing terms history is ambiguous',
        )
      }

      const { current, replacement } = changeAthleteBillingTerms({
        current: openTerms[0]!,
        replacementId: input.termsId,
        effectiveFrom: input.effectiveFrom,
        monthlyAmountMinor: input.monthlyAmountMinor,
        currency: input.currency,
      })

      await repository.replaceAthleteBillingTerms(current, replacement)
      return replacement
    },
  }
}
