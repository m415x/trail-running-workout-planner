/**
 * Read-only athlete administration projection.
 *
 * Sports-administration facts belong to the athlete profile, not the EPT
 * account. Legacy user fields are exposed with explicit provenance only
 * until the reviewed backfill takes place. Neither contact nor name proves
 * account ownership or an authenticated session.
 */
export type AthleteAdministrativeReadInput = {
  id: string
  teamId: string
  userId: string | null
  firstName: string | null
  lastName: string | null
  contactEmail: string | null
  phone: string | null
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
}

type Source = 'athlete_profile' | 'legacy_user' | 'missing'

export type AthleteAdministrativeRead = {
  athleteId: string
  teamId: string
  userId: string | null
  name: { firstName: string; lastName: string; source: Exclude<Source, 'missing'> } | null
  email: { value: string | null; source: Source }
  phone: { value: string | null; source: 'athlete_profile' | 'missing' }
}

/**
 * This function is not an authorization boundary. Callers must already have
 * scoped the athlete to an authorized team. Missing facts stay missing.
 */
export function projectAthleteAdministrativeRead(
  athlete: AthleteAdministrativeReadInput,
): AthleteAdministrativeRead {
  if (athlete.user && athlete.user.id !== athlete.userId) {
    throw new Error('Athlete administrative identity mismatch')
  }

  let name: AthleteAdministrativeRead['name'] = null
  if (athlete.firstName !== null && athlete.lastName !== null) {
    name = { firstName: athlete.firstName, lastName: athlete.lastName, source: 'athlete_profile' }
  } else if (athlete.user !== null) {
    name = { firstName: athlete.user.firstName, lastName: athlete.user.lastName, source: 'legacy_user' }
  }

  const email = athlete.contactEmail !== null
    ? { value: athlete.contactEmail, source: 'athlete_profile' as const }
    : athlete.user
      ? { value: athlete.user.email, source: 'legacy_user' as const }
      : { value: null, source: 'missing' as const }

  return {
    athleteId: athlete.id,
    teamId: athlete.teamId,
    userId: athlete.userId,
    name,
    email,
    phone: {
      value: athlete.phone,
      source: athlete.phone === null ? 'missing' : 'athlete_profile',
    },
  }
}
