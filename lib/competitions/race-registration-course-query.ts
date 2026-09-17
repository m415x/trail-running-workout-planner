import { buildCourseRegistrationData } from '@/lib/competitions/race-registration-course-data'

type Athlete = {
  athleteProfileId: string
  athleteName: string
}

type Registration = {
  athleteProfileId: string
  raceCourseId: string
  courseLabel: string
}

type Dependencies = {
  listActiveAthletes: (teamId: string) => Promise<Athlete[]> | Athlete[]
  listEffectiveRegistrationsInEdition: (input: {
    teamId: string
    raceEditionId: string
  }) => Promise<Registration[]> | Registration[]
}

export async function loadCourseRegistrationData(
  input: {
    teamId: string
    raceEditionId: string
    raceCourseId: string
  },
  dependencies: Dependencies,
) {
  const athletes = await dependencies.listActiveAthletes(input.teamId)
  const registrations = await dependencies.listEffectiveRegistrationsInEdition({
    teamId: input.teamId,
    raceEditionId: input.raceEditionId,
  })

  return buildCourseRegistrationData({
    raceCourseId: input.raceCourseId,
    athletes,
    registrations,
  })
}
