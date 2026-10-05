/**
 * Plans a one-time, foreign-key-scoped transfer of legacy administrative facts.
 *
 * Only an existing athlete.userId -> users.id association is admissible.
 * The caller must load that user by the persisted FK, not search by email,
 * personal name or document number. This pure plan does not authenticate users.
 */
export type AdministrativeBackfillAthlete = {
  id: string
  userId: string | null
  firstName: string | null
  lastName: string | null
  contactEmail: string | null
}

export type AdministrativeBackfillUser = {
  id: string
  firstName: string
  lastName: string
  email: string
}

export type AdministrativeBackfillPlan = {
  athleteId: string
  changes: Partial<Pick<AdministrativeBackfillAthlete, 'firstName' | 'lastName' | 'contactEmail'>>
}

/**
 * Existing profile values always prevail, including after an operator edits
 * them. A persistence migration must apply this plan transactionally and
 * preserve the same no-overwrite rule in its UPDATE predicates.
 */
export function planAthleteAdministrativeBackfill(input: {
  athlete: AdministrativeBackfillAthlete
  linkedUser: AdministrativeBackfillUser | null
}): AdministrativeBackfillPlan {
  const { athlete, linkedUser } = input
  const changes: AdministrativeBackfillPlan['changes'] = {}

  if (athlete.userId === null) return { athleteId: athlete.id, changes }
  if (linkedUser === null) return { athleteId: athlete.id, changes }
  if (linkedUser.id !== athlete.userId) {
    throw new Error('Athlete administrative identity mismatch')
  }

  if (athlete.firstName === null) changes.firstName = linkedUser.firstName
  if (athlete.lastName === null) changes.lastName = linkedUser.lastName
  if (athlete.contactEmail === null) changes.contactEmail = linkedUser.email

  return { athleteId: athlete.id, changes }
}
