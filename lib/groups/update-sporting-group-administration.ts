import { and, eq, ne } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import { athleteGroups } from '@/db/schema'

export interface UpdateSportingGroupAdministrationInput {
  groupId: string
  teamId: string
  description: string | null
  isActive: boolean
  updatedAt: string
}

export function updateSportingGroupAdministration<TSchema extends Record<string, unknown>>(
  database: BetterSQLite3Database<TSchema>,
  input: UpdateSportingGroupAdministrationInput,
): void {
  const group = database
    .select({ id: athleteGroups.id })
    .from(athleteGroups)
    .where(and(
      eq(athleteGroups.id, input.groupId),
      eq(athleteGroups.teamId, input.teamId),
      eq(athleteGroups.isDeleted, false),
    ))
    .limit(1)
    .get()

  if (!group) {
    throw new Error('Grupo no encontrado')
  }

  database.update(athleteGroups)
    .set({
      description: input.description,
      isActive: input.isActive,
      updatedAt: input.updatedAt,
    })
    .where(and(
      eq(athleteGroups.id, group.id),
      eq(athleteGroups.teamId, input.teamId),
      ne(athleteGroups.isDeleted, true),
    ))
    .run()
}
