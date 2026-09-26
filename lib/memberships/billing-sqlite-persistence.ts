import type {
  AthleteBillingTerms,
  GlobalDueDateExceptionRevision,
  MonthlyChargeCandidate,
  TeamEconomicPolicy,
} from './billing'
import type {
  BillingPersistencePort,
  GlobalDueDateExceptionPersistencePort,
} from './billing-persistence'

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
  listGlobalDueDateExceptionRevisions: (
    teamId: string,
    year: number,
    month: number,
  ) => Promise<GlobalDueDateExceptionRevision[]>
  replaceCurrentGlobalDueDateException: (
    teamId: string,
    year: number,
    month: number,
    revision: GlobalDueDateExceptionRevision,
  ) => Promise<void>
  listTeamMonthlyCharges: (
    teamId: string,
    year: number,
    month: number,
  ) => Promise<MonthlyChargeCandidate[]>
  getBillingTermsById: (
    billingTermsId: string,
  ) => Promise<AthleteBillingTerms>
  updateMonthlyChargeDueDates: (
    teamId: string,
    charge: MonthlyChargeCandidate,
  ) => Promise<void>
}

export function createSqliteBillingPersistencePort(
  database: SqliteBillingDatabase,
): BillingPersistencePort & GlobalDueDateExceptionPersistencePort {
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

    listGlobalDueDateExceptionRevisions: (teamId, year, month) =>
      database.listGlobalDueDateExceptionRevisions(teamId, year, month),

    async replaceCurrentGlobalDueDateException(teamId, year, month, revision) {
      if (
        revision.teamId !== teamId
        || revision.year !== year
        || revision.month !== month
      ) {
        throw new Error('Global due-date exception identity is outside the requested team period scope')
      }

      await database.replaceCurrentGlobalDueDateException(
        teamId,
        year,
        month,
        revision,
      )
    },

    listTeamMonthlyCharges: (teamId, year, month) =>
      database.listTeamMonthlyCharges(teamId, year, month),

    getBillingTermsById: (billingTermsId) =>
      database.getBillingTermsById(billingTermsId),

    async updateMonthlyChargeDueDates(teamId, charge) {
      await database.updateMonthlyChargeDueDates(teamId, charge)
    },
  }
}
