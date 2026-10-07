import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import { teamMemberships } from '@/db/schema'
import type { TeamMembershipPreset } from '@/types'

export interface ResolveTeamMembershipPresetInput {
  userId: string
  teamId: string
  onDate: string
}

export function resolveTeamMembershipPreset<TSchema extends Record<string, unknown>>(
  database: BetterSQLite3Database<TSchema>,
  input: ResolveTeamMembershipPresetInput,
): TeamMembershipPreset | null {
  const rows = database
    .select({
      preset: teamMemberships.preset,
      effectiveFrom: teamMemberships.effectiveFrom,
    })
    .from(teamMemberships)
    .where(
      and(
        eq(teamMemberships.userId, input.userId),
        eq(teamMemberships.teamId, input.teamId),
        eq(teamMemberships.isActive, true),
        eq(teamMemberships.isDeleted, false),
        lte(teamMemberships.effectiveFrom, input.onDate),
        or(
          isNull(teamMemberships.effectiveUntil),
          gt(teamMemberships.effectiveUntil, input.onDate),
        ),
      ),
    )
    .orderBy(desc(teamMemberships.effectiveFrom))
    .limit(2)
    .all()

  if (rows.length === 0) return null
  if (rows.length > 1) {
    throw new Error('Conflicting active TeamMembership records')
  }

  return rows[0]?.preset ?? null
}
