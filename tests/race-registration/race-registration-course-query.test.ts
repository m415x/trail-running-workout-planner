import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loadCourseRegistrationData } from '@/lib/competitions/race-registration-course-query'

describe('course registration query', () => {
  it('loads active team athletes and effective edition registrations before partitioning them', async () => {
    const calls: string[] = []
    const result = await loadCourseRegistrationData(
      {
        teamId: 'team-1',
        raceEditionId: 'edition-1',
        raceCourseId: 'course-21k',
      },
      {
        listActiveAthletes: (teamId) => {
          calls.push(`athletes:${teamId}`)
          return [
            { athleteProfileId: 'athlete-1', athleteName: 'Ana' },
            { athleteProfileId: 'athlete-2', athleteName: 'Juan' },
            { athleteProfileId: 'athlete-3', athleteName: 'Pedro' },
          ]
        },
        listEffectiveRegistrationsInEdition: ({ teamId, raceEditionId }) => {
          calls.push(`registrations:${teamId}:${raceEditionId}`)
          return [
            { registrationId: 'registration-2', athleteProfileId: 'athlete-2', raceCourseId: 'course-21k', courseLabel: '21K' },
            { registrationId: 'registration-3', athleteProfileId: 'athlete-3', raceCourseId: 'course-42k', courseLabel: '42K' },
          ]
        },
      },
    )

    assert.deepEqual(calls, ['athletes:team-1', 'registrations:team-1:edition-1'])
    assert.deepEqual(result, {
      eligible: [{ athleteProfileId: 'athlete-1', athleteName: 'Ana' }],
      registeredHere: [{ athleteProfileId: 'athlete-2', athleteName: 'Juan', registrationId: 'registration-2', courseLabel: '21K' }],
      registeredElsewhere: [{ athleteProfileId: 'athlete-3', athleteName: 'Pedro', registrationId: 'registration-3', courseLabel: '42K' }],
    })
  })
})
