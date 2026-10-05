export type AthleteNameWriteIntent = 'preserve' | 'replace'

export interface AthleteEditableName {
  firstName: string
  lastName: string
}

/**
 * Legacy User names may be shown as a temporary read fallback, but saving an
 * unrelated edit must not promote those values into AthleteProfile.
 */
export function resolveAthleteNameWriteIntent(
  initial: AthleteEditableName,
  current: AthleteEditableName,
): AthleteNameWriteIntent {
  return initial.firstName === current.firstName && initial.lastName === current.lastName
    ? 'preserve'
    : 'replace'
}
