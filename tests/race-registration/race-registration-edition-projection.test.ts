import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { projectRaceEditionRegistrations } from '../../lib/competitions/race-registration-application'
import type { RaceRegistrationPersistenceInput } from '../../types/training/race-registration.types'

const registration = (overrides: Partial<RaceRegistrationPersistenceInput> = {}): RaceRegistrationPersistenceInput => ({
  id: 'registration-1',
  teamId: 'team-1',
  athleteProfileId: 'athlete-1',
  course: { raceEventId: 'event-1', raceEditionId: 'edition-1', raceCourseId: 'course-1' },
  snapshot: {
    eventName: 'Andes Trail',
    editionLabel: '2026',
    editionDate: '2026-09-20',
    courseLabel: '30K',
    nominalDistanceKm: 30,
    nominalElevationGainM: 1400,
  },
  registrationStatus: 'registered',
  participationStatus: 'unknown',
  result: null,
  ...overrides,
})

describe('race edition registration projection', () => {
  it('groups effective registrations by course and preserves explicit participation/result facts', () => {
    const projected = projectRaceEditionRegistrations([
      registration(),
      registration({
        id: 'registration-2',
        athleteProfileId: 'athlete-2',
        participationStatus: 'finished',
        result: { actualDistanceKm: 28.4, elapsedTimeSeconds: 10800 },
      }),
      registration({
        id: 'registration-3',
        athleteProfileId: 'athlete-3',
        course: { raceEventId: 'event-1', raceEditionId: 'edition-1', raceCourseId: 'course-2' },
        snapshot: {
          eventName: 'Andes Trail',
          editionLabel: '2026',
          editionDate: '2026-09-20',
          courseLabel: '15K',
          nominalDistanceKm: 15,
          nominalElevationGainM: 600,
        },
        participationStatus: 'dnf',
        result: { actualDistanceKm: null, elapsedTimeSeconds: null },
      }),
      registration({
        id: 'cancelled',
        registrationStatus: 'cancelled',
      }),
    ])

    assert.equal(projected.length, 2)
    assert.equal(projected[0]?.raceCourseId, 'course-1')
    assert.equal(projected[0]?.courseLabel, '30K')
    assert.equal(projected[0]?.registrations.length, 2)
    assert.deepEqual(projected[0]?.registrations[0], {
      registrationId: 'registration-1',
      athleteProfileId: 'athlete-1',
      participationStatus: 'unknown',
      actualDistanceKm: null,
      elapsedTimeSeconds: null,
    })
    assert.deepEqual(projected[0]?.registrations[1], {
      registrationId: 'registration-2',
      athleteProfileId: 'athlete-2',
      participationStatus: 'finished',
      actualDistanceKm: 28.4,
      elapsedTimeSeconds: 10800,
    })
    assert.equal(projected[1]?.raceCourseId, 'course-2')
    assert.equal(projected[1]?.registrations[0]?.participationStatus, 'dnf')
    assert.equal(projected[1]?.registrations[0]?.actualDistanceKm, null)
  })
})
