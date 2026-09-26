import {
  getAthleteBillingSnapshot,
  materializeMonthlyCharges,
  type AthleteBillingTerms,
  type MonthlyChargeCandidate,
  type TeamEconomicPolicy,
} from './billing'

export type BillingPersistencePort = {
  athleteBelongsToTeam: (teamId: string, athleteId: string) => Promise<boolean>
  listBillingTerms: (teamId: string, athleteId: string) => Promise<AthleteBillingTerms[]>
  listMonthlyCharges: (teamId: string, athleteId: string) => Promise<MonthlyChargeCandidate[]>
  listTeamEconomicPolicies: (teamId: string) => Promise<TeamEconomicPolicy[]>
  insertMonthlyCharges: (
    teamId: string,
    athleteId: string,
    charges: MonthlyChargeCandidate[],
  ) => Promise<void>
}

export function createBillingPersistenceAdapter(port: BillingPersistencePort) {
  return {
    async getAthleteBillingSnapshot(input: {
      teamId: string
      athleteId: string
    }) {
      return getAthleteBillingSnapshot({
        ...input,
        repository: {
          athleteBelongsToTeam: port.athleteBelongsToTeam,
          getBillingTerms: (athleteId) =>
            port.listBillingTerms(input.teamId, athleteId),
          getMonthlyCharges: (athleteId) =>
            port.listMonthlyCharges(input.teamId, athleteId),
        },
      })
    },

    async materializeMonthlyCharges(input: {
      teamId: string
      athleteId: string
      through: { year: number; month: number }
    }) {
      const belongsToTeam = await port.athleteBelongsToTeam(
        input.teamId,
        input.athleteId,
      )

      if (!belongsToTeam) {
        throw new Error('Athlete does not belong to the requested team')
      }

      return materializeMonthlyCharges({
        athleteId: input.athleteId,
        through: input.through,
        repository: {
          getBillingTerms: (athleteId) =>
            port.listBillingTerms(input.teamId, athleteId),
          getTeamEconomicPolicies: () =>
            port.listTeamEconomicPolicies(input.teamId),
          getMonthlyCharges: (athleteId) =>
            port.listMonthlyCharges(input.teamId, athleteId),
          insertMonthlyCharges: (charges) =>
            port.insertMonthlyCharges(input.teamId, input.athleteId, charges),
        },
      })
    },
  }
}
