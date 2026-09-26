import { and, eq } from 'drizzle-orm'

import {
  athleteBillingTerms,
  athleteProfiles,
  globalMonthlyDueDateExceptions,
  monthlyCharges,
  monthlyChargeReductions,
  teamEconomicPolicies,
} from '@/db/schema'
import type {
  AthleteBillingTerms,
  GlobalDueDateExceptionRevision,
  MonthlyChargeCandidate,
  TeamEconomicPolicy,
} from './billing'
import type { SqliteBillingDatabase } from './billing-sqlite-persistence'
import type { PersistedMonthlyChargeReductionRevision } from './billing-persistence'

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

function mapMonthlyChargeReduction(row: QueryResult): PersistedMonthlyChargeReductionRevision {
  return {
    id: String(row.id),
    monthlyChargeId: String(row.monthlyChargeId),
    athleteId: String(row.athleteId),
    year: Number(row.year),
    month: Number(row.month),
    reductionAmountMinor: Number(row.reductionAmountMinor),
    reason: String(row.reason),
    isCurrent: Boolean(row.isCurrent),
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

type DrizzleMutationClient = DrizzleInsert & Partial<DrizzleUpdate>

type DrizzleBillingClient = DrizzleQuery & Partial<DrizzleInsert> & Partial<DrizzleUpdate> & {
  transaction?: (callback: (tx: DrizzleMutationClient) => Promise<void>) => Promise<void>
}

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

    async listTeamMonthlyCharges(teamId, year, month) {
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
          eq(monthlyCharges.year, year),
          eq(monthlyCharges.month, month),
          eq(monthlyCharges.isDeleted, false),
        ))

      return rows.map((row: QueryResult) =>
        mapCharge((row.monthly_charges ?? row.monthlyCharges ?? row) as QueryResult),
      )
    },

    async getBillingTermsById(billingTermsId) {
      const rows = await client
        .select()
        .from(athleteBillingTerms)
        .where(and(
          eq(athleteBillingTerms.id, billingTermsId),
          eq(athleteBillingTerms.isDeleted, false),
        ))
      const row = rows[0]
      if (!row) throw new Error('Billing terms not found')
      return mapTerms(row)
    },

    async updateMonthlyChargeDueDates(teamId, charge) {
      if (!(await athleteBelongsToTeam(teamId, charge.athleteId))) {
        throw new Error('Monthly charge athlete is outside the requested team scope')
      }
      if (!client.update) throw new Error('Drizzle client does not support updates')
      await client.update(monthlyCharges)
        .set({
          baseDueDate: charge.baseDueDate,
          effectiveDueDate: charge.effectiveDueDate,
          updatedAt: new Date().toISOString(),
        })
        .where(and(
          eq(monthlyCharges.athleteId, charge.athleteId),
          eq(monthlyCharges.year, charge.year),
          eq(monthlyCharges.month, charge.month),
        ))
    },

    async applyGlobalDueDateExceptionAtomically(teamId, year, month, revision, charges) {
      if (
        revision.teamId !== teamId
        || revision.year !== year
        || revision.month !== month
        || charges.some((charge) => charge.year !== year || charge.month !== month)
      ) {
        throw new Error('Global due-date exception application is outside the requested team period scope')
      }
      if (!client.transaction) throw new Error('Drizzle client does not support transactions')

      for (const charge of charges) {
        if (!(await athleteBelongsToTeam(teamId, charge.athleteId))) {
          throw new Error('Monthly charge projection is outside the requested team scope')
        }
      }

      const revisions = await this.listGlobalDueDateExceptionRevisions(teamId, year, month)
      const current = revisions.filter((candidate) => candidate.isCurrent)
      if (current.length > 1) {
        throw new Error('Ambiguous current global due-date exception revisions')
      }
      const active = current[0]
      const isRetry = active
        && active.dueDate === revision.dueDate
        && active.reason === revision.reason

      const now = new Date().toISOString()
      await client.transaction(async (tx) => {
        if (active && !isRetry) {
          if (!tx.update) throw new Error('Drizzle transaction does not support updates')
          await tx.update(globalMonthlyDueDateExceptions)
            .set({ isCurrent: false, updatedAt: now })
            .where(eq(globalMonthlyDueDateExceptions.id, active.id))
        }

        if (!isRetry) {
          await tx.insert(globalMonthlyDueDateExceptions).values([{
            ...revision,
            isCurrent: true,
            isDeleted: false,
            createdAt: now,
            updatedAt: now,
          }])
        }

        if (!tx.update && charges.length > 0) {
          throw new Error('Drizzle transaction does not support updates')
        }
        for (const charge of charges) {
          await tx.update!(monthlyCharges)
            .set({
              baseDueDate: charge.baseDueDate,
              effectiveDueDate: charge.effectiveDueDate,
              updatedAt: now,
            })
            .where(and(
              eq(monthlyCharges.athleteId, charge.athleteId),
              eq(monthlyCharges.year, charge.year),
              eq(monthlyCharges.month, charge.month),
            ))
        }
      })
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

      const revisions = await this.listGlobalDueDateExceptionRevisions(teamId, year, month)
      const current = revisions.filter((candidate) => candidate.isCurrent)
      if (current.length > 1) {
        throw new Error('Ambiguous current global due-date exception revisions')
      }

      const active = current[0]
      if (
        active
        && active.dueDate === revision.dueDate
        && active.reason === revision.reason
      ) {
        return
      }

      if (!client.transaction) throw new Error('Drizzle client does not support transactions')

      const now = new Date().toISOString()
      await client.transaction(async (tx) => {
        if (active) {
          if (!tx.update) throw new Error('Drizzle transaction does not support updates')
          await tx.update(globalMonthlyDueDateExceptions)
            .set({ isCurrent: false, updatedAt: now })
            .where(eq(globalMonthlyDueDateExceptions.id, active.id))
        }

        await tx.insert(globalMonthlyDueDateExceptions).values([{
          ...revision,
          isCurrent: true,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        }])
      })
    },

    async applyMonthlyChargeReductionAtomically(teamId, monthlyChargeId, revision, charge) {
      if (
        revision.monthlyChargeId !== monthlyChargeId
        || revision.athleteId !== charge.athleteId
        || revision.year !== charge.year
        || revision.month !== charge.month
      ) {
        throw new Error('Monthly charge reduction application is outside the requested charge scope')
      }
      if (!(await athleteBelongsToTeam(teamId, charge.athleteId))) {
        throw new Error('Monthly charge reduction is outside the requested team scope')
      }
      if (!client.transaction) throw new Error('Drizzle client does not support transactions')

      const rows = await client.select().from(monthlyChargeReductions).where(and(
        eq(monthlyChargeReductions.monthlyChargeId, monthlyChargeId),
        eq(monthlyChargeReductions.isDeleted, false),
      ))
      const revisions = rows.map(mapMonthlyChargeReduction)
      const current = revisions.filter((candidate) => candidate.isCurrent)
      if (current.length > 1) {
        throw new Error('Ambiguous current monthly charge reduction revisions')
      }
      const active = current[0]
      const isRetry = active
        && active.athleteId === revision.athleteId
        && active.year === revision.year
        && active.month === revision.month
        && active.reductionAmountMinor === revision.reductionAmountMinor
        && active.reason === revision.reason

      const now = new Date().toISOString()
      await client.transaction(async (tx) => {
        if (active && !isRetry) {
          if (!tx.update) throw new Error('Drizzle transaction does not support updates')
          await tx.update(monthlyChargeReductions)
            .set({ isCurrent: false, updatedAt: now })
            .where(eq(monthlyChargeReductions.id, active.id))
        }

        if (!isRetry) {
          await tx.insert(monthlyChargeReductions).values([{
            id: revision.id,
            monthlyChargeId,
            reductionAmountMinor: revision.reductionAmountMinor,
            reason: revision.reason,
            isCurrent: true,
            isDeleted: false,
            createdAt: now,
            updatedAt: now,
          }])
        }

        if (!tx.update) throw new Error('Drizzle transaction does not support updates')
        await tx.update(monthlyCharges)
          .set({
            amountDueMinor: charge.amountDueMinor,
            updatedAt: now,
          })
          .where(and(
            eq(monthlyCharges.athleteId, charge.athleteId),
            eq(monthlyCharges.year, charge.year),
            eq(monthlyCharges.month, charge.month),
          ))
      })
    },

    async listMonthlyChargeReductionRevisions(monthlyChargeId) {
      const rows = await client
        .select()
        .from(monthlyChargeReductions)
        .innerJoin(
          monthlyCharges,
          eq(monthlyCharges.id, monthlyChargeReductions.monthlyChargeId),
        )
        .where(and(
          eq(monthlyChargeReductions.monthlyChargeId, monthlyChargeId),
          eq(monthlyChargeReductions.isDeleted, false),
          eq(monthlyCharges.isDeleted, false),
        ))

      return rows.map((row: QueryResult) => {
        const reduction = (row.monthly_charge_reductions ?? row.monthlyChargeReductions ?? row) as QueryResult
        const charge = (row.monthly_charges ?? row.monthlyCharges ?? row) as QueryResult
        return mapMonthlyChargeReduction({
          ...reduction,
          athleteId: charge.athleteId,
          year: charge.year,
          month: charge.month,
        })
      })
    },

    async replaceCurrentMonthlyChargeReduction(monthlyChargeId, revision) {
      if (revision.monthlyChargeId !== monthlyChargeId) {
        throw new Error('Monthly charge reduction identity is outside the requested charge scope')
      }

      const rows = await client.select().from(monthlyChargeReductions).where(and(
        eq(monthlyChargeReductions.monthlyChargeId, monthlyChargeId),
        eq(monthlyChargeReductions.isDeleted, false),
      ))
      const revisions = rows.map(mapMonthlyChargeReduction)
      const current = revisions.filter((candidate) => candidate.isCurrent)
      if (current.length > 1) {
        throw new Error('Ambiguous current monthly charge reduction revisions')
      }

      const active = current[0]
      if (
        active
        && active.athleteId === revision.athleteId
        && active.year === revision.year
        && active.month === revision.month
        && active.reductionAmountMinor === revision.reductionAmountMinor
        && active.reason === revision.reason
      ) {
        return
      }

      if (!client.transaction) throw new Error('Drizzle client does not support transactions')

      const now = new Date().toISOString()
      await client.transaction(async (tx) => {
        if (active) {
          if (!tx.update) throw new Error('Drizzle transaction does not support updates')
          await tx.update(monthlyChargeReductions)
            .set({ isCurrent: false, updatedAt: now })
            .where(eq(monthlyChargeReductions.id, active.id))
        }

        await tx.insert(monthlyChargeReductions).values([{
          id: revision.id,
          monthlyChargeId: revision.monthlyChargeId,
          reductionAmountMinor: revision.reductionAmountMinor,
          reason: revision.reason,
          isCurrent: true,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        }])
      })
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
