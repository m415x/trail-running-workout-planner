type Athlete = {
  athleteProfileId: string
  athleteName: string
}

type Registration = {
  registrationId: string
  athleteProfileId: string
  raceCourseId: string
  courseLabel: string
}

export function buildCourseRegistrationData(input: {
  raceCourseId: string
  athletes: Athlete[]
  registrations: Registration[]
}) {
  const registrationsByAthlete = new Map(
    input.registrations.map((registration) => [registration.athleteProfileId, registration]),
  )
  const eligible: Athlete[] = []
  const registeredHere: Array<Athlete & { registrationId: string; courseLabel: string }> = []
  const registeredElsewhere: Array<Athlete & { registrationId: string; courseLabel: string }> = []

  for (const athlete of input.athletes) {
    const registration = registrationsByAthlete.get(athlete.athleteProfileId)
    if (!registration) {
      eligible.push(athlete)
      continue
    }

    const registeredAthlete = {
      ...athlete,
      registrationId: registration.registrationId,
      courseLabel: registration.courseLabel,
    }

    if (registration.raceCourseId === input.raceCourseId) {
      registeredHere.push(registeredAthlete)
    } else {
      registeredElsewhere.push(registeredAthlete)
    }
  }

  return { eligible, registeredHere, registeredElsewhere }
}
