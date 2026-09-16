import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'

import { createRaceCourse, createRaceEdition, createRaceEvent } from '@/lib/race-catalog/catalog-repository'
import {
  createRaceRegistration,
  getRaceRegistration,
} from '@/lib/competitions/race-registration-repository'

function catalog() {
  const event = createRaceEvent({ name: `Ansilta XK ${randomUUID()}` })
  const edition = createRaceEdition({
    raceEventId: event.id,
    label: 'Ansilta XK 2026',
    startDate: '2026-10-18',
    status: 'published',
  })
  const course = createRaceCourse({
    raceEditionId: edition.id,
    label: '30K',
    distanceKm: 30,
    elevationGainM: 1650,
    status: 'published',
  })
  return { event, edition, course }
}

describe('race registration SQLite repository', () => {
  it('round-trips registration, snapshot, participation and result facts', () => {
    const { event, edition, course } = catalog()
    const id = randomUUID()
    const teamId = `team-${randomUUID()}`
    const athleteProfileId = `athlete-${randomUUID()}`

    createRaceRegistration({
      id,
      teamId,
      athleteProfileId,
      course: { raceEventId: event.id, raceEditionId: edition.id, raceCourseId: course.id },
      registrationStatus: 'registered',
      participationStatus: 'finished',
      snapshot: {
        eventName: event.name,
        editionLabel: edition.label,
        editionDate: edition.startDate,
        courseLabel: course.label,
        nominalDistanceKm: course.distanceKm,
        nominalElevationGainM: course.elevationGainM,
      },
      result: { actualDistanceKm: 30.4, elapsedTimeSeconds: 10_800 },
    })

    assert.deepEqual(getRaceRegistration(id), {
      id,
      teamId,
      athleteProfileId,
      course: { raceEventId: event.id, raceEditionId: edition.id, raceCourseId: course.id },
      registrationStatus: 'registered',
      participationStatus: 'finished',
      snapshot: {
        eventName: event.name,
        editionLabel: edition.label,
        editionDate: edition.startDate,
        courseLabel: course.label,
        nominalDistanceKm: 30,
        nominalElevationGainM: 1650,
      },
      result: { actualDistanceKm: 30.4, elapsedTimeSeconds: 10_800 },
    })
  })

  it('rejects a registration whose supplied ancestry does not match the selected catalog course', () => {
    const { event, edition, course } = catalog()

    assert.throws(() => createRaceRegistration({
      id: randomUUID(),
      teamId: `team-${randomUUID()}`,
      athleteProfileId: `athlete-${randomUUID()}`,
      course: { raceEventId: event.id, raceEditionId: `${edition.id}-wrong`, raceCourseId: course.id },
      registrationStatus: 'registered',
      participationStatus: 'unknown',
      snapshot: {
        eventName: event.name,
        editionLabel: edition.label,
        editionDate: edition.startDate,
        courseLabel: course.label,
        nominalDistanceKm: course.distanceKm,
        nominalElevationGainM: course.elevationGainM,
      },
      result: null,
    }), /catalog hierarchy/i)
  })

  it('lets the database reject a second registration for the same team + athlete + edition', () => {
    const { event, edition, course } = catalog()
    const teamId = `team-${randomUUID()}`
    const athleteProfileId = `athlete-${randomUUID()}`
    const base = {
      teamId,
      athleteProfileId,
      course: { raceEventId: event.id, raceEditionId: edition.id, raceCourseId: course.id },
      registrationStatus: 'registered' as const,
      participationStatus: 'unknown' as const,
      snapshot: {
        eventName: event.name,
        editionLabel: edition.label,
        editionDate: edition.startDate,
        courseLabel: course.label,
        nominalDistanceKm: course.distanceKm,
        nominalElevationGainM: course.elevationGainM,
      },
      result: null,
    }

    createRaceRegistration({ id: randomUUID(), ...base })
    assert.throws(() => createRaceRegistration({ id: randomUUID(), ...base }), /unique|constraint/i)
  })
})
