import type { RaceRegistrationDraft } from '@/types/training/race-registration.types'

export type RaceRegistrationDraftValidationError =
  | 'registration_id_required'
  | 'team_id_required'
  | 'athlete_profile_id_required'
  | 'race_event_id_required'
  | 'race_edition_id_required'
  | 'race_course_id_required'

export interface RaceRegistrationEditionConflict {
  key: string
  registrationIds: string[]
}

export function validateRaceRegistrationDraft(
  draft: RaceRegistrationDraft,
): RaceRegistrationDraftValidationError[] {
  const errors: RaceRegistrationDraftValidationError[] = []

  if (!draft.id.trim()) errors.push('registration_id_required')
  if (!draft.teamId.trim()) errors.push('team_id_required')
  if (!draft.athleteProfileId.trim()) errors.push('athlete_profile_id_required')
  if (!draft.course.raceEventId.trim()) errors.push('race_event_id_required')
  if (!draft.course.raceEditionId.trim()) errors.push('race_edition_id_required')
  if (!draft.course.raceCourseId.trim()) errors.push('race_course_id_required')

  return errors
}

/** Business identity for at most one effective registration per athlete and edition. */
export function raceRegistrationEditionKey(draft: RaceRegistrationDraft): string {
  return JSON.stringify([draft.teamId, draft.athleteProfileId, draft.course.raceEditionId])
}

/**
 * Finds conflicting registration rows using the domain business identity.
 *
 * Course changes within an edition do not create a second registration identity;
 * persistence enforcement is intentionally owned by the later repository/DB task.
 */
export function findRaceRegistrationEditionConflicts(
  registrations: readonly RaceRegistrationDraft[],
): RaceRegistrationEditionConflict[] {
  const byKey = new Map<string, string[]>()

  for (const registration of registrations) {
    const key = raceRegistrationEditionKey(registration)
    const registrationIds = byKey.get(key)

    if (registrationIds) registrationIds.push(registration.id)
    else byKey.set(key, [registration.id])
  }

  return [...byKey.entries()]
    .filter(([, registrationIds]) => registrationIds.length > 1)
    .map(([key, registrationIds]) => ({ key, registrationIds }))
}
