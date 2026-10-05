import { and, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import { teamMemberships } from '@/db/schema'

export interface RevokeTeamMembershipInput {
  userId: string
  teamId: string
  effectiveUntil: string
  updatedAt: string
}

export function revokeTeamMembership<TSchema extends Record<string, unknown>>(
  database: BetterSQLite3Database<TSchema>,
  input: RevokeTeamMembershipInput,
): void {
  const membership = database
    .select({ id: teamMemberships.id })
    .from(teamMemberships)
    .where(
      and(
        eq(teamMemberships.userId, input.userId),
        eq(teamMemberships.teamId, input.teamId),
        eq(teamMemberships.isActive, true),
        eq(teamMemberships.isDeleted, false),
      ),
    )
    .get()

  if (!membership) {
    throw new Error('Team membership not found')
  }

  database
    .update(teamMemberships)
    .set({
      isActive: false,
      effectiveUntil: input.effectiveUntil,
      updatedAt: input.updatedAt,
    })
    .where(eq(teamMemberships.id, membership.id))
    .run()
}
