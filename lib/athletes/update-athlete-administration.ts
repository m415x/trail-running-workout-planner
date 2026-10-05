import { and, eq, ne } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import { athleteProfiles } from '@/db/schema'
import type { AthleteNameWriteIntent } from '@/features/athletes/lib/athlete-name-write-intent'

export interface UpdateAthleteAdministrationInput {
  teamId: string
  athleteId: string
  firstName: string
  lastName: string
  contactEmail: string | null
  dni: string
  nickName: string | null
  birthday: string | null
  phone: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
  nameWriteIntent: AthleteNameWriteIntent
  updatedAt: string
}

/**
 * Updates only sport-owned AthleteProfile administration.
 *
 * User/Auth identity is deliberately outside this writer. The team predicate
 * is part of the persistence boundary so an athlete id from another team
 * cannot be edited through this operation.
 */
export function updateAthleteAdministration<TSchema extends Record<string, unknown>>(
  database: BetterSQLite3Database<TSchema>,
  input: UpdateAthleteAdministrationInput,
): void {
  database.transaction((tx) => {
    const athlete = tx
      .select({ id: athleteProfiles.id })
      .from(athleteProfiles)
      .where(and(
        eq(athleteProfiles.id, input.athleteId),
        eq(athleteProfiles.teamId, input.teamId),
        eq(athleteProfiles.isDeleted, false),
      ))
      .get()

    if (!athlete) {
      throw new Error('Atleta no encontrado')
    }

    const duplicateDni = tx
      .select({ id: athleteProfiles.id })
      .from(athleteProfiles)
      .where(and(
        eq(athleteProfiles.teamId, input.teamId),
        eq(athleteProfiles.dni, input.dni),
        ne(athleteProfiles.id, input.athleteId),
        eq(athleteProfiles.isDeleted, false),
      ))
      .get()

    if (duplicateDni) {
      throw new Error('Ya existe un atleta con ese DNI')
    }

    const administrativeName = input.nameWriteIntent === 'replace'
      ? { firstName: input.firstName, lastName: input.lastName }
      : {}

    tx
      .update(athleteProfiles)
      .set({
        ...administrativeName,
        contactEmail: input.contactEmail,
        nickName: input.nickName,
        dni: input.dni,
        birthday: input.birthday,
        phone: input.phone,
        emergencyContact: input.emergencyContact,
        emergencyPhone: input.emergencyPhone,
        updatedAt: input.updatedAt,
      })
      .where(and(
        eq(athleteProfiles.id, input.athleteId),
        eq(athleteProfiles.teamId, input.teamId),
      ))
      .run()
  })
}
