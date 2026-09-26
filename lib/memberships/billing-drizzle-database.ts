import { and, eq } from 'drizzle-orm'

import {
  athleteBillingTerms,
  athleteProfiles,
  globalMonthlyDueDateExceptions,
  monthlyCharges,
  teamEconomicPolicies,
} from '@/db/schema'
import type {
  AthleteBillingTerms,
  GlobalDueDateExceptionRevision,
  MonthlyChargeCandidate,
  TeamEconomicPolicy,
} from './billing'
import type { SqliteBillingDatabase } from './billing-sqlite-persistence'

type QueryResult = Record<string, unknown>

type DrizzleQuery = {
  select: () => {
    from: (table: unknown) => {
      innerJoin: (
        table: unknown,
        on: unknown,
      ) => {
        where: (condition: unknown) => Promise<QueryResult[]>
      }
      where: (condition: unknown) => Promise<QueryResult[]>
    }
  }
}

function mapGlobalDueDateException(row: QueryResult): GlobalDueDateExceptionRevision {
  return {
    id: String(row.id),
    teamId: String(row.teamId),
    year: Number(row.year),
    month: Number(row.month),
    dueDate: String(row.dueDate),
    reason: String(row.reason),
    isCurrent: Boolean(row.isCurrent),
  }
}

type DrizzleInsert = {
  insert: (table: unknown) => {
    values: (values: Record<string, unknown>[]) => Promise<unknown>
  }
}

type DrizzleUpdate = {
  update: (table: unknown) => {
    set: (values: Record<string, unknown>) => {
      where: (condition: unknown) => Promise<unknown>
    }
  }
}

type DrizzleBillingClient = DrizzleQuery & Partial<DrizzleInsert> & Partial<DrizzleUpdate>

function mapTerms(row: QueryResult): AthleteBillingTerms {
  return {
    id: String(row.id),
    athleteId: String(row.athleteId),
    monthlyAmountMinor: Number(row.monthlyAmountMinor),
    currency: String(row.currency),
    effectiveFrom: String(row.effectiveFrom),
    effectiveUntil: row.effectiveUntil === null ? null : String(row.effectiveUntil),
  }
}

function mapPolicy(row: QueryResult): TeamEconomicPolicy {
  return {
    id: String(row.id),
    teamId: String(row.teamId),
    defaultMonthlyAmountMinor: Number(row.defaultMonthlyAmountMinor),
    currency: String(row.currency),
    ordinaryDueDay: Number(row.ordinaryDueDay),
    effectiveFrom: String(row.effectiveFrom),
    effectiveUntil: row.effectiveUntil === null ? null : String(row.effectiveUntil),
  }
}

function mapCharge(row: QueryResult): MonthlyChargeCandidate {
  return {
    athleteId: String(row.athleteId),
    billingTermsId: String(row.billingTermsId),
    year: Number(row.year),
    month: Number(row.month),
    baseAmountMinor: Number(row.baseAmountMinor),
    amountDueMinor: Number(row.amountDueMinor),
    currency: String(row.currency),
    baseDueDate: String(row.baseDueDate),
    effectiveDueDate: String(row.effectiveDueDate),
  }
}

export function createDrizzleBillingDatabase(
  db: unknown,
): SqliteBillingDatabase {
  const client = db as DrizzleBillingClient
  async function athleteBelongsToTeam(teamId: string, athleteId: string) {
    const rows = await client
      .select()
      .from(athleteProfiles)
      .where(and(
        eq(athleteProfiles.id, athleteId),
        eq(athleteProfiles.teamId, teamId),
        eq(athleteProfiles.isDeleted, false),
      ))

    return rows.length > 0
  }

  return {
    athleteBelongsToTeam,

    async listBillingTerms(teamId, athleteId) {
      const rows = await client
        .select()
        .from(athleteBillingTerms)
        .innerJoin(
          athleteProfiles,
          and(
            eq(athleteProfiles.id, athleteBillingTerms.athleteId),
            eq(athleteProfiles.teamId, teamId),
            eq(athleteProfiles.isDeleted, false),
          ),
        )
        .where(and(
          eq(athleteBillingTerms.athleteId, athleteId),
          eq(athleteBillingTerms.isDeleted, false),
        ))

      return rows.map((row: QueryResult) =>
        mapTerms((row.athlete_billing_terms ?? row.athleteBillingTerms ?? row) as QueryResult),
      )
    },

    async listMonthlyCharges(teamId, athleteId) {
      const rows = await client
        .select()
        .from(monthlyCharges)
        .innerJoin(
          athleteProfiles,
          and(
            eq(athleteProfiles.id, monthlyCharges.athleteId),
            eq(athleteProfiles.teamId, teamId),
            eq(athleteProfiles.isDeleted, false),
          ),
        )
        .where(and(
          eq(monthlyCharges.athleteId, athleteId),
          eq(monthlyCharges.isDeleted, false),
        ))

      return rows.map((row: QueryResult) =>
        mapCharge((row.monthly_charges ?? row.monthlyCharges ?? row) as QueryResult),
      )
    },

    async listTeamEconomicPolicies(teamId) {
      const rows = await client
        .select()
        .from(teamEconomicPolicies)
        .where(and(
          eq(teamEconomicPolicies.teamId, teamId),
          eq(teamEconomicPolicies.isDeleted, false),
        ))

      return rows.map(mapPolicy)
    },

    async listGlobalDueDateExceptionRevisions(teamId, year, month) {
      const rows = await client.select().from(globalMonthlyDueDateExceptions).where(and(
        eq(globalMonthlyDueDateExceptions.teamId, teamId),
        eq(globalMonthlyDueDateExceptions.year, year),
        eq(globalMonthlyDueDateExceptions.month, month),
        eq(globalMonthlyDueDateExceptions.isDeleted, false),
      ))
      return rows.map(mapGlobalDueDateException)
    },

    async replaceCurrentGlobalDueDateException(teamId, year, month, revision) {
      if (
        revision.teamId !== teamId
        || revision.year !== year
        || revision.month !== month
      ) {
        throw new Error('Global due-date exception identity is outside the requested team period scope')
      }
      if (!client.insert) throw new Error('Drizzle client does not support inserts')
      await client.insert(globalMonthlyDueDateExceptions).values([{
        ...revision,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }])
    },

    async insertMonthlyCharges(teamId, athleteId, charges) {
      if (!(await athleteBelongsToTeam(teamId, athleteId))) {
        throw new Error('Athlete does not belong to the requested team')
      }

      if (charges.some((charge) => charge.athleteId !== athleteId)) {
        throw new Error('Monthly charge athlete is outside the requested athlete scope')
      }

      if (charges.length === 0) return
      if (!client.insert) throw new Error('Drizzle client does not support inserts')

      const now = new Date().toISOString()
      await client.insert(monthlyCharges).values(
        charges.map((charge) => ({
          id: crypto.randomUUID(),
          ...charge,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        })),
      )
    },
  }
}
