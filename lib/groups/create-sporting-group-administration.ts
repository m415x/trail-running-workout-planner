import { and, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import { athleteGroups } from '@/db/schema'
import type { AthleteCategoryCode, AthleteLevelCode } from '@/types'

export interface CreateSportingGroupAdministrationInput {
  groupId: string
  teamId: string
  categoryCode: AthleteCategoryCode
  levelCode: AthleteLevelCode
  description: string | null
  createdAt: string
}

export function createSportingGroupAdministration<TSchema extends Record<string, unknown>>(
  database: BetterSQLite3Database<TSchema>,
  input: CreateSportingGroupAdministrationInput,
): void {
  const duplicate = database
    .select({ id: athleteGroups.id })
    .from(athleteGroups)
    .where(and(
      eq(athleteGroups.teamId, input.teamId),
      eq(athleteGroups.categoryCode, input.categoryCode),
      eq(athleteGroups.levelCode, input.levelCode),
    ))
    .limit(1)
    .get()

  if (duplicate) {
    throw new Error(`Ya existe el grupo ${input.categoryCode}${input.levelCode}`)
  }

  database.insert(athleteGroups).values({
    id: input.groupId,
    teamId: input.teamId,
    categoryCode: input.categoryCode,
    levelCode: input.levelCode,
    description: input.description,
    isActive: true,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  }).run()
}
