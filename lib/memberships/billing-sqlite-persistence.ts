import type {
  AthleteBillingTerms,
  MonthlyChargeCandidate,
  TeamEconomicPolicy,
} from './billing'
import type { BillingPersistencePort } from './billing-persistence'

export type SqliteBillingDatabase = {
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

export function createSqliteBillingPersistencePort(
  database: SqliteBillingDatabase,
): BillingPersistencePort {
  return {
    athleteBelongsToTeam: (teamId, athleteId) =>
      database.athleteBelongsToTeam(teamId, athleteId),

    listBillingTerms: (teamId, athleteId) =>
      database.listBillingTerms(teamId, athleteId),

    listMonthlyCharges: (teamId, athleteId) =>
      database.listMonthlyCharges(teamId, athleteId),

    listTeamEconomicPolicies: (teamId) =>
      database.listTeamEconomicPolicies(teamId),

    async insertMonthlyCharges(teamId, athleteId, charges) {
      if (charges.some((charge) => charge.athleteId !== athleteId)) {
        throw new Error('Monthly charge athlete is outside the requested athlete scope')
      }

      await database.insertMonthlyCharges(teamId, athleteId, charges)
    },
  }
}
