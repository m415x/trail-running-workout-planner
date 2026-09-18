import {
  parseRaceRegistrationActionRequest,
  raceRegistrationRevalidationPaths,
} from '@/lib/competitions/race-registration-server-action'

type BulkRegistrationInput = {
  teamId: string
  raceCourseId: string
  submittedAthleteProfileIds: string[]
}

type Dependencies<Result> = {
  teamId: string
  runBulkRegistration: (input: BulkRegistrationInput) => Promise<Result> | Result
  revalidatePath: (path: string) => void
}

export async function executeRaceRegistrationServerAction<Result>(
  formData: FormData,
  dependencies: Dependencies<Result>,
) {
  const request = parseRaceRegistrationActionRequest(formData)
  const result = await dependencies.runBulkRegistration({
    teamId: dependencies.teamId,
    raceCourseId: request.raceCourseId,
    submittedAthleteProfileIds: request.submittedAthleteProfileIds,
  })

  for (const path of raceRegistrationRevalidationPaths(request.locale)) {
    dependencies.revalidatePath(path)
  }

  return result
}
