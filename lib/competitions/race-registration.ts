import type { RaceRegistrationDraft } from '@/types/training/race-registration.types'

export type RaceRegistrationDraftValidationError =
  | 'registration_id_required'
  | 'team_id_required'
  | 'athlete_profile_id_required'
  | 'race_event_id_required'
  | 'race_edition_id_required'
  | 'race_course_id_required'

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
