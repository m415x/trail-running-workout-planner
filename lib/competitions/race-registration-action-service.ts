import { parseBulkRegistrationSelection } from '@/lib/competitions/race-registration-course-ui'
import type { RaceCourse, RaceEdition, RaceEvent } from '@/types/training/race-catalog.types'

type BulkRegistrationResult = {
  requested: number
  succeeded: number
  failed: number
  registrations: Array<{ athleteProfileId: string; registrationId: string }>
  failures: Array<{
    athleteProfileId: string
    reason: 'already_registered_in_edition'
    existingCourseLabel: string
  }>
}

type Dependencies = {
  getRaceCourse: (id: string) => RaceCourse | null
  getRaceEdition: (id: string) => RaceEdition | null
  getRaceEvent: (id: string) => RaceEvent | null
  listSelectableAthleteProfileIds: (input: {
    teamId: string
    raceEditionId: string
  }) => Promise<string[]> | string[]
  executeBulkRegistration: (input: {
    teamId: string
    athleteProfileIds: string[]
    target: { event: RaceEvent; edition: RaceEdition; course: RaceCourse }
  }) => Promise<BulkRegistrationResult> | BulkRegistrationResult
}

export async function runBulkRaceRegistrationAction(
  input: {
    teamId: string
    raceCourseId: string
    submittedAthleteProfileIds: string[]
  },
  dependencies: Dependencies,
) {
  const course = dependencies.getRaceCourse(input.raceCourseId)
  if (!course) throw new Error('Race catalog hierarchy is unavailable')

  const edition = dependencies.getRaceEdition(course.raceEditionId)
  if (!edition || edition.id !== course.raceEditionId) {
    throw new Error('Race catalog hierarchy is inconsistent')
  }

  const event = dependencies.getRaceEvent(edition.raceEventId)
  if (!event || event.id !== edition.raceEventId) {
    throw new Error('Race catalog hierarchy is inconsistent')
  }

  const selectableAthleteProfileIds = await dependencies.listSelectableAthleteProfileIds({
    teamId: input.teamId,
    raceEditionId: edition.id,
  })
  const athleteProfileIds = parseBulkRegistrationSelection({
    submittedAthleteProfileIds: input.submittedAthleteProfileIds,
    selectableAthleteProfileIds,
  })

  if (athleteProfileIds.length === 0) {
    throw new Error('No eligible athletes remain selected for registration')
  }

  return dependencies.executeBulkRegistration({
    teamId: input.teamId,
    athleteProfileIds,
    target: { event, edition, course },
  })
}
