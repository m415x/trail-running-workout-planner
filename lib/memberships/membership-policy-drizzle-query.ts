import { and, eq } from 'drizzle-orm'

import { globalMonthlyDueDateExceptions, teamEconomicPolicies } from '@/db/schema'
import type { GlobalDueDateExceptionRevision, TeamEconomicPolicy } from './billing'
import type { TeamEconomicPolicyQueryRepository } from './membership-policy-query'

type QueryResult = Record<string, unknown>

type SyncDrizzlePolicyQueryClient = {
  select: () => {
    from: (table: unknown) => {
      where: (condition: unknown) => {
        all: () => QueryResult[]
      }
    }
  }
}

function mapGlobalException(row: QueryResult): GlobalDueDateExceptionRevision {
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

function mapPolicy(row: QueryResult): TeamEconomicPolicy {
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

export function createTeamEconomicPolicyQueryRepository(
  db: unknown,
): TeamEconomicPolicyQueryRepository {
  const client = db as SyncDrizzlePolicyQueryClient

  return {
    async listGlobalDueDateExceptionRevisions(teamId) {
      const rows = client
        .select()
        .from(globalMonthlyDueDateExceptions)
        .where(and(
          eq(globalMonthlyDueDateExceptions.teamId, teamId),
          eq(globalMonthlyDueDateExceptions.isDeleted, false),
        ))
        .all()

      return rows.map(mapGlobalException)
    },

    async listTeamEconomicPolicies(teamId) {
      const rows = client
        .select()
        .from(teamEconomicPolicies)
        .where(and(
          eq(teamEconomicPolicies.teamId, teamId),
          eq(teamEconomicPolicies.isDeleted, false),
        ))
        .all()

      return rows.map(mapPolicy)
    },
  }
}
