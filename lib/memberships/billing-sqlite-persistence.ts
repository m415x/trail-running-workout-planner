import type {
  AthleteBillingTerms,
  GlobalDueDateExceptionRevision,
  MonthlyChargeCandidate,
  TeamEconomicPolicy,
} from './billing'
import type {
  BillingPersistencePort,
  GlobalDueDateExceptionPersistencePort,
  MonthlyChargeReductionPersistencePort,
  PersistedMonthlyChargeReductionRevision,
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
  listMonthlyChargeReductionRevisions?: (
    monthlyChargeId: string,
  ) => Promise<PersistedMonthlyChargeReductionRevision[]>
  replaceCurrentMonthlyChargeReduction?: (
    monthlyChargeId: string,
    revision: PersistedMonthlyChargeReductionRevision,
  ) => Promise<void>
  applyMonthlyChargeReductionAtomically?: (
    teamId: string,
    monthlyChargeId: string,
    revision: PersistedMonthlyChargeReductionRevision,
    charge: MonthlyChargeCandidate,
  ) => Promise<void>
  listTeamMonthlyCharges?: (
    teamId: string,
    year: number,
    month: number,
  ) => Promise<MonthlyChargeCandidate[]>
  getBillingTermsById?: (
    billingTermsId: string,
  ) => Promise<AthleteBillingTerms>
  updateMonthlyChargeDueDates?: (
    teamId: string,
    charge: MonthlyChargeCandidate,
  ) => Promise<void>
  applyGlobalDueDateExceptionAtomically?: (
    teamId: string,
    year: number,
    month: number,
    revision: GlobalDueDateExceptionRevision,
    charges: MonthlyChargeCandidate[],
  ) => Promise<void>
}

export function createSqliteBillingPersistencePort(
  database: SqliteBillingDatabase,
): BillingPersistencePort & GlobalDueDateExceptionPersistencePort & MonthlyChargeReductionPersistencePort {
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

    async listMonthlyChargeReductionRevisions(monthlyChargeId) {
      if (!database.listMonthlyChargeReductionRevisions) {
        throw new Error('SQLite billing database does not support monthly charge reduction reads')
      }
      return database.listMonthlyChargeReductionRevisions(monthlyChargeId)
    },

    async replaceCurrentMonthlyChargeReduction(monthlyChargeId, revision) {
      if (revision.monthlyChargeId !== monthlyChargeId) {
        throw new Error('Monthly charge reduction identity is outside the requested charge scope')
      }

      if (!database.replaceCurrentMonthlyChargeReduction) {
        throw new Error('SQLite billing database does not support monthly charge reduction replacement')
      }
      await database.replaceCurrentMonthlyChargeReduction(monthlyChargeId, revision)
    },

    async applyMonthlyChargeReductionAtomically(teamId, monthlyChargeId, revision, charge) {
      if (!database.applyMonthlyChargeReductionAtomically) {
        throw new Error('SQLite billing database does not support atomic monthly charge reductions')
      }
      await database.applyMonthlyChargeReductionAtomically(
        teamId,
        monthlyChargeId,
        revision,
        charge,
      )
    },

    async listTeamMonthlyCharges(teamId, year, month) {
      if (!database.listTeamMonthlyCharges) {
        throw new Error('SQLite billing database does not support team monthly charge reads')
      }
      return database.listTeamMonthlyCharges(teamId, year, month)
    },

    async getBillingTermsById(billingTermsId) {
      if (!database.getBillingTermsById) {
        throw new Error('SQLite billing database does not support billing terms lookup')
      }
      return database.getBillingTermsById(billingTermsId)
    },

    async updateMonthlyChargeDueDates(teamId, charge) {
      if (!database.updateMonthlyChargeDueDates) {
        throw new Error('SQLite billing database does not support charge due-date updates')
      }
      await database.updateMonthlyChargeDueDates(teamId, charge)
    },

    async applyGlobalDueDateExceptionAtomically(teamId, year, month, revision, charges) {
      if (!database.applyGlobalDueDateExceptionAtomically) {
        throw new Error('SQLite billing database does not support atomic global due-date exception application')
      }
      await database.applyGlobalDueDateExceptionAtomically(
        teamId,
        year,
        month,
        revision,
        charges,
      )
    },
  }
}
