import { and, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import { athleteProfiles } from '@/db/schema'

export interface CreateAthleteAdministrationInput {
  athleteId: string
  teamId: string
  firstName: string
  lastName: string
  contactEmail: string | null
  dni: string
  nickName: string | null
  birthday: string | null
  phone: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
  createdAt: string
}

type TransactionOf<TSchema extends Record<string, unknown>> =
  Parameters<Parameters<BetterSQLite3Database<TSchema>['transaction']>[0]>[0]

/**
 * Creates one sport-owned AthleteProfile and composes economic initialization
 * inside the same SQLite transaction. No EPT User or Auth identity is created
 * or inferred from administrative contact data.
 */
export function createAthleteAdministration<TSchema extends Record<string, unknown>>(
  database: BetterSQLite3Database<TSchema>,
  input: CreateAthleteAdministrationInput,
  initializeBilling: (transaction: TransactionOf<TSchema>) => void,
): void {
  database.transaction((tx) => {
    const duplicateDni = tx
      .select({ id: athleteProfiles.id })
      .from(athleteProfiles)
      .where(and(
        eq(athleteProfiles.teamId, input.teamId),
        eq(athleteProfiles.dni, input.dni),
        eq(athleteProfiles.isDeleted, false),
      ))
      .get()

    if (duplicateDni) {
      throw new Error('Ya existe un atleta con ese DNI')
    }

    tx.insert(athleteProfiles).values({
      id: input.athleteId,
      userId: null,
      teamId: input.teamId,
      groupId: null,
      isActive: true,
      firstName: input.firstName,
      lastName: input.lastName,
      contactEmail: input.contactEmail,
      nickName: input.nickName,
      dni: input.dni,
      birthday: input.birthday,
      phone: input.phone,
      emergencyContact: input.emergencyContact,
      emergencyPhone: input.emergencyPhone,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    }).run()

    initializeBilling(tx)
  })
}
