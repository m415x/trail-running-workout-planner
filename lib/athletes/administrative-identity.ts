/**
 * Administrative identity facts owned by an athlete profile within one team.
 *
 * These facts are independent of EPT account details and Supabase Auth. In
 * particular, contactEmail is a sporting/administrative contact channel, not
 * proof of ownership of an EPT account or a credential for signing in.
 *
 * Persistence and legacy data backfill are handled by KAN-601/T2 and T5.
 */
export type AthleteAdministrativeIdentity = {
  athleteId: string
  teamId: string
  userId: string | null
  firstName: string
  lastName: string
  contactEmail: string | null
  phone: string | null
}

export type EptAccountIdentity = {
  id: string
  firstName: string
  lastName: string
  email: string
}

/** Retain the sport-owned administrative values without synthesizing a User. */
export function defineAthleteAdministrativeIdentity(
  identity: AthleteAdministrativeIdentity,
): AthleteAdministrativeIdentity {
  return { ...identity }
}

/**
 * Never merge account contact data into an existing athlete identity.
 * A verified identity association is a separate operation, not something
 * inferred from matching email, names, or other personally supplied values.
 */
export function resolveAthleteAdministrativeIdentity(
  athlete: AthleteAdministrativeIdentity,
  account: EptAccountIdentity | null,
): AthleteAdministrativeIdentity {
  if (account !== null && athlete.userId !== account.id) {
    throw new Error('Athlete administrative identity mismatch')
  }

  return { ...athlete }
}
