import { and, eq } from 'drizzle-orm'

import { teamEconomicPolicies } from '@/db/schema'
import type { TeamEconomicPolicy } from './billing'
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
