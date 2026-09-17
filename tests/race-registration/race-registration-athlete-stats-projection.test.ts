import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { projectAthleteRaceRegistrations } from '../../lib/athlete-stats/athlete-race-registration-projection'
import type { RaceRegistrationPersistenceInput } from '../../types/training/race-registration.types'

const registration = (
  overrides: Partial<RaceRegistrationPersistenceInput>,
): RaceRegistrationPersistenceInput => ({
  id: 'registration_1',
  teamId: 'team_1',
  athleteProfileId: 'athlete_1',
  course: {
    raceEventId: 'event_1',
    raceEditionId: 'edition_1',
    raceCourseId: 'course_1',
  },
  registrationStatus: 'registered',
  participationStatus: 'unknown',
  snapshot: {
    eventName: 'Race',
    editionLabel: '2026',
    editionDate: '2026-10-20',
    courseLabel: '30K',
    nominalDistanceKm: 30,
    nominalElevationGainM: 1200,
  },
  result: null,
  ...overrides,
})

describe('athlete-safe race registration projection', () => {
  it('separates upcoming effective registrations from historical participation facts', () => {
    const upcoming = registration({ id: 'upcoming' })
    const historical = registration({
      id: 'history',
      participationStatus: 'dnf',
      snapshot: {
        ...upcoming.snapshot,
        editionDate: '2026-08-10',
      },
      result: { actualDistanceKm: 0, elapsedTimeSeconds: null },
    })

    const result = projectAthleteRaceRegistrations([upcoming, historical], '2026-09-17')

    assert.equal(result.upcoming.length, 1)
    assert.equal(result.upcoming[0]?.registrationId, 'upcoming')
    assert.equal(result.history.length, 1)
    assert.equal(result.history[0]?.participationStatus, 'dnf')
    assert.equal(result.history[0]?.actualDistanceKm, 0)
    assert.equal(result.history[0]?.elapsedTimeSeconds, null)
  })

  it('exposes only factual athlete-safe fields and excludes cancelled registrations', () => {
    const cancelled = registration({
      id: 'cancelled',
      registrationStatus: 'cancelled',
    })
    const historicalUnknown = registration({
      id: 'history',
      snapshot: {
        ...cancelled.snapshot,
        editionDate: '2026-08-10',
      },
    })

    const result = projectAthleteRaceRegistrations([cancelled, historicalUnknown], '2026-09-17')
    const item = result.history[0]

    assert.equal(result.upcoming.length, 0)
    assert.equal(result.history.length, 1)
    assert.equal(item?.participationStatus, 'unknown')
    assert.equal(item?.actualDistanceKm, null)
    assert.deepEqual(Object.keys(item ?? {}).sort(), [
      'actualDistanceKm',
      'courseLabel',
      'editionDate',
      'editionLabel',
      'elapsedTimeSeconds',
      'eventName',
      'nominalDistanceKm',
      'nominalElevationGainM',
      'participationStatus',
      'raceCourseId',
      'registrationId',
    ].sort())
  })
})
