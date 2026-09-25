import { and, eq } from 'drizzle-orm'

import {
  athleteBillingTerms,
  athleteProfiles,
  teamEconomicPolicies,
} from '@/db/schema'
import type {
  AthleteBillingTerms,
  TeamEconomicPolicy,
} from './billing'
import type { SynchronousBillingCoachRepository } from './billing-coach-service'
import type { SynchronousAthleteBillingTermsRepository } from './athlete-billing-terms-service'

type SyncResult<T> = {
  all?: () => T[]
  get?: () => T | undefined | null
  run?: () => unknown
}

type SyncDrizzleClient = {
  select: () => {
    from: (table: unknown) => {
      where: (condition: unknown) => SyncResult<Record<string, unknown>>
    }
  }
  insert: (table: unknown) => {
    values: (value: Record<string, unknown>) => SyncResult<never>
  }
  update: (table: unknown) => {
    set: (value: Record<string, unknown>) => {
      where: (condition: unknown) => SyncResult<never>
    }
  }
}

function rows(result: SyncResult<Record<string, unknown>>) {
  return result.all?.() ?? []
}

function mapPolicy(row: Record<string, unknown>): TeamEconomicPolicy {
  return {
    id: String(row.id),
    teamId: String(row.teamId),
    defaultMonthlyAmountMinor: Number(row.defaultMonthlyAmountMinor),
    currency: String(row.currency),
    ordinaryDueDay: Number(row.ordinaryDueDay),
    effectiveFrom: String(row.effectiveFrom),
    effectiveUntil: row.effectiveUntil == null ? null : String(row.effectiveUntil),
  }
}

function mapTerms(row: Record<string, unknown>): AthleteBillingTerms {
  return {
    id: String(row.id),
    athleteId: String(row.athleteId),
    monthlyAmountMinor: Number(row.monthlyAmountMinor),
    currency: String(row.currency),
    effectiveFrom: String(row.effectiveFrom),
    effectiveUntil: row.effectiveUntil == null ? null : String(row.effectiveUntil),
  }
}

export type SynchronousDrizzleBillingRepository =
  SynchronousBillingCoachRepository & SynchronousAthleteBillingTermsRepository

export function createSynchronousDrizzleBillingRepository(
  db: SyncDrizzleClient,
): SynchronousDrizzleBillingRepository {
  const now = () => new Date().toISOString()

  return {
    athleteBelongsToTeam(teamId, athleteId) {
      const result = db.select().from(athleteProfiles).where(and(
        eq(athleteProfiles.id, athleteId),
        eq(athleteProfiles.teamId, teamId),
        eq(athleteProfiles.isDeleted, false),
      ))
      const found = result.get?.()
      return found ? true : rows(result).length > 0
    },

    listTeamEconomicPolicies(teamId) {
      return rows(
        db.select().from(teamEconomicPolicies).where(and(
          eq(teamEconomicPolicies.teamId, teamId),
          eq(teamEconomicPolicies.isDeleted, false),
        )),
      ).map(mapPolicy)
    },

    saveTeamEconomicPolicy(policy) {
      db.insert(teamEconomicPolicies).values({
        ...policy,
        isDeleted: false,
        createdAt: now(),
        updatedAt: now(),
      }).run?.()
    },

    replaceTeamEconomicPolicy(current, replacement) {
      db.update(teamEconomicPolicies)
        .set({ effectiveUntil: current.effectiveUntil, updatedAt: now() })
        .where(eq(teamEconomicPolicies.id, current.id))
        .run?.()
      db.insert(teamEconomicPolicies).values({
        ...replacement,
        isDeleted: false,
        createdAt: now(),
        updatedAt: now(),
      }).run?.()
    },

    listAthleteBillingTerms(teamId, athleteId) {
      if (!this.athleteBelongsToTeam(teamId, athleteId)) {
        throw new Error('Athlete does not belong to the requested team')
      }
      return rows(
        db.select().from(athleteBillingTerms).where(and(
          eq(athleteBillingTerms.athleteId, athleteId),
          eq(athleteBillingTerms.isDeleted, false),
        )),
      ).map(mapTerms)
    },

    saveAthleteBillingTerms(terms) {
      db.insert(athleteBillingTerms).values({
        ...terms,
        isDeleted: false,
        createdAt: now(),
        updatedAt: now(),
      }).run?.()
    },

    replaceAthleteBillingTerms(current, replacement) {
      db.update(athleteBillingTerms)
        .set({ effectiveUntil: current.effectiveUntil, updatedAt: now() })
        .where(eq(athleteBillingTerms.id, current.id))
        .run?.()
      db.insert(athleteBillingTerms).values({
        ...replacement,
        isDeleted: false,
        createdAt: now(),
        updatedAt: now(),
      }).run?.()
    },
  }
}
