import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  parseRaceRegistrationActionRequest,
  raceRegistrationRevalidationPaths,
} from '@/lib/competitions/race-registration-server-action'

describe('race registration Next.js server action contract', () => {
  it('parses only the trusted action request surface from FormData', () => {
    const formData = new FormData()
    formData.set('locale', 'es')
    formData.set('raceCourseId', 'course-21k')
    formData.append('athleteProfileId', 'athlete-1')
    formData.append('athleteProfileId', 'athlete-2')
    formData.set('teamId', 'tampered-team')
    formData.set('raceEditionId', 'tampered-edition')

    assert.deepEqual(parseRaceRegistrationActionRequest(formData), {
      locale: 'es',
      raceCourseId: 'course-21k',
      submittedAthleteProfileIds: ['athlete-1', 'athlete-2'],
    })
  })

  it('rejects malformed or empty action requests before orchestration', () => {
    const formData = new FormData()
    formData.set('locale', 'es')
    formData.set('raceCourseId', '')

    assert.throws(() => parseRaceRegistrationActionRequest(formData), /invalid registration request/i)
  })

  it('revalidates both course-first and athlete-first competition surfaces after a mutation', () => {
    assert.deepEqual(raceRegistrationRevalidationPaths('en'), [
      '/[locale]/dashboard/competitions/[[...segments]]',
      '/en/dashboard/athletes',
    ])
    assert.deepEqual(raceRegistrationRevalidationPaths('es'), [
      '/[locale]/dashboard/competitions/[[...segments]]',
      '/dashboard/athletes',
    ])
  })
})
