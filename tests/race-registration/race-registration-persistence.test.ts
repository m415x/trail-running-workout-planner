import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  assertPersistableRaceRegistration,
  raceRegistrationPersistenceKey,
  toRaceRegistrationPersistenceRecord,
} from '@/lib/competitions/race-registration-persistence'
import type { RaceRegistrationPersistenceInput } from '@/types/training/race-registration.types'

const registration = (
  overrides: Partial<RaceRegistrationPersistenceInput> = {},
): RaceRegistrationPersistenceInput => ({
  id: 'registration-1',
  teamId: 'team-1',
  athleteProfileId: 'athlete-1',
  course: {
    raceEventId: 'event-ansilta-xk',
    raceEditionId: 'edition-ansilta-xk-2026',
    raceCourseId: 'course-30k',
  },
  registrationStatus: 'registered',
  participationStatus: 'finished',
  snapshot: {
    eventName: 'Ansilta XK',
    editionLabel: 'Ansilta XK 2026',
    editionDate: '2026-10-18',
    courseLabel: '30K',
    nominalDistanceKm: 30,
    nominalElevationGainM: 1650,
  },
  result: {
    actualDistanceKm: 30.4,
    elapsedTimeSeconds: 10_800,
  },
  ...overrides,
})

describe('race registration persistence contract', () => {
  it('round-trips the durable registration facts without deriving or dropping evidence', () => {
    const input = registration()
    const record = toRaceRegistrationPersistenceRecord(input)

    assert.deepEqual(record, {
      id: input.id,
      teamId: input.teamId,
      athleteProfileId: input.athleteProfileId,
      raceEventId: input.course.raceEventId,
      raceEditionId: input.course.raceEditionId,
      raceCourseId: input.course.raceCourseId,
      registrationStatus: input.registrationStatus,
      participationStatus: input.participationStatus,
      snapshot: input.snapshot,
      result: input.result,
    })
  })

  it('preserves null and known zero result metrics through the persistence shape', () => {
    const record = toRaceRegistrationPersistenceRecord(registration({
      result: { actualDistanceKm: 0, elapsedTimeSeconds: null },
    }))

    assert.deepEqual(record.result, { actualDistanceKm: 0, elapsedTimeSeconds: null })
  })

  it('uses team + athlete + edition as persistence uniqueness independent from course', () => {
    const first = registration()
    const changedCourse = registration({
      id: 'registration-2',
      course: { ...first.course, raceCourseId: 'course-42k' },
      snapshot: { ...first.snapshot, courseLabel: '42K', nominalDistanceKm: 42 },
    })

    assert.equal(raceRegistrationPersistenceKey(first), raceRegistrationPersistenceKey(changedCourse))
  })

  it('keeps the same edition independent across teams and athletes', () => {
    const first = registration()

    assert.notEqual(
      raceRegistrationPersistenceKey(first),
      raceRegistrationPersistenceKey(registration({ teamId: 'team-2' })),
    )
    assert.notEqual(
      raceRegistrationPersistenceKey(first),
      raceRegistrationPersistenceKey(registration({ athleteProfileId: 'athlete-2' })),
    )
  })

  it('requires the persisted course reference to match the catalog hierarchy', () => {
    const input = registration()

    assert.doesNotThrow(() => assertPersistableRaceRegistration(input, input.course))
    assert.throws(
      () => assertPersistableRaceRegistration(input, {
        raceEventId: input.course.raceEventId,
        raceEditionId: input.course.raceEditionId,
        raceCourseId: 'course-from-another-edition',
      }),
      /catalog hierarchy/i,
    )
  })

  it('keeps snapshot and result as historical facts rather than catalog-derived persistence', () => {
    const input = registration({
      snapshot: {
        eventName: 'Historical event name',
        editionLabel: 'Historical edition label',
        editionDate: '2026-10-18',
        courseLabel: 'Historical 30K',
        nominalDistanceKm: 30,
        nominalElevationGainM: 1650,
      },
      result: { actualDistanceKm: null, elapsedTimeSeconds: null },
    })

    const record = toRaceRegistrationPersistenceRecord(input)

    assert.equal(record.snapshot.eventName, 'Historical event name')
    assert.equal(record.snapshot.courseLabel, 'Historical 30K')
    assert.deepEqual(record.result, { actualDistanceKm: null, elapsedTimeSeconds: null })
  })
})
