export type RaceRegistrationActionRequest = {
  locale: 'es' | 'en'
  raceCourseId: string
  submittedAthleteProfileIds: string[]
}

export function parseRaceRegistrationActionRequest(formData: FormData): RaceRegistrationActionRequest {
  const locale = String(formData.get('locale') ?? '')
  const raceCourseId = String(formData.get('raceCourseId') ?? '').trim()
  const submittedAthleteProfileIds = formData
    .getAll('athleteProfileId')
    .map((value) => String(value).trim())
    .filter(Boolean)

  if ((locale !== 'es' && locale !== 'en') || !raceCourseId || submittedAthleteProfileIds.length === 0) {
    throw new Error('Invalid registration request')
  }

  return {
    locale,
    raceCourseId,
    submittedAthleteProfileIds,
  }
}

export function raceRegistrationRevalidationPaths(locale: 'es' | 'en') {
  return [
    '/[locale]/dashboard/competitions/[[...segments]]',
    locale === 'es' ? '/dashboard/athletes' : `/${locale}/dashboard/athletes`,
  ]
}
