import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildCourseRegistrationData } from '@/lib/competitions/race-registration-course-data'

describe('course registration data', () => {
  it('separates eligible athletes from registrations here and elsewhere in the edition', () => {
    const result = buildCourseRegistrationData({
      raceCourseId: 'course-21k',
      athletes: [
        { athleteProfileId: 'athlete-1', athleteName: 'Ana' },
        { athleteProfileId: 'athlete-2', athleteName: 'Juan' },
        { athleteProfileId: 'athlete-3', athleteName: 'Pedro' },
      ],
      registrations: [
        { registrationId: 'registration-2', athleteProfileId: 'athlete-2', raceCourseId: 'course-21k', courseLabel: '21K' },
        { registrationId: 'registration-3', athleteProfileId: 'athlete-3', raceCourseId: 'course-42k', courseLabel: '42K' },
      ],
    })

    assert.deepEqual(result, {
      eligible: [
        { athleteProfileId: 'athlete-1', athleteName: 'Ana' },
      ],
      registeredHere: [
        { athleteProfileId: 'athlete-2', athleteName: 'Juan', registrationId: 'registration-2', courseLabel: '21K' },
      ],
      registeredElsewhere: [
        { athleteProfileId: 'athlete-3', athleteName: 'Pedro', registrationId: 'registration-3', courseLabel: '42K' },
      ],
    })
  })
})
