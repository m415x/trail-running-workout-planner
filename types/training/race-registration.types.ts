import type { RaceCourseReference } from '@/types/training/race-catalog.types'

/** Effective lifecycle of an athlete's individual registration for one race edition. */
export type RaceRegistrationStatus = 'registered' | 'cancelled'

/** Factual participation evidence; `unknown` means no participation fact is known. */
export type RaceParticipationStatus = 'unknown' | 'started' | 'finished' | 'dnf' | 'dns'

/**
 * Minimum individual race-registration fact.
 *
 * Registration is independent from TrainingGoal, CompetitionEntry and eventual
 * participation/result facts. Team and athlete scope are explicit, while the
 * concrete competitive identity always points to a RaceCourse.
 */
export interface RaceRegistrationDraft {
  /** Opaque registration identity; no business meaning is encoded in this id. */
  id: string
  teamId: string
  athleteProfileId: string
  course: RaceCourseReference
  registrationStatus: RaceRegistrationStatus
}
