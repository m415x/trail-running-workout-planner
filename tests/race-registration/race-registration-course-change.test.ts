import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  changeRaceRegistrationCourse,
  createRaceRegistrationSnapshot,
} from '@/lib/competitions/race-registration-course'
import type {
  RaceRegistrationCourseState,
  RaceRegistrationSnapshot,
} from '@/types/training/race-registration.types'
import type { RaceCourse, RaceEdition, RaceEvent } from '@/types/training/race-catalog.types'

const event: RaceEvent = {
  id: 'event_1',
  name: 'Ansilta XK',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const edition: RaceEdition = {
  id: 'edition_2026',
  raceEventId: event.id,
  label: 'Ansilta XK 2026',
  startDate: '2026-10-18',
  status: 'published',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const course30k: RaceCourse = {
  id: 'course_30k',
  raceEditionId: edition.id,
  label: '30K',
  distanceKm: 30,
  elevationGainM: 1650,
  modality: { code: 'trail' },
  classifications: [],
  status: 'published',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const course42k: RaceCourse = {
  ...course30k,
  id: 'course_42k',
  label: '42K',
  distanceKm: 42,
  elevationGainM: 2400,
}

const state = (overrides: Partial<RaceRegistrationCourseState> = {}): RaceRegistrationCourseState => ({
  course: {
    raceEventId: event.id,
    raceEditionId: edition.id,
    raceCourseId: course30k.id,
  },
  snapshot: createRaceRegistrationSnapshot(event, edition, course30k),
  participationStatus: 'unknown',
  ...overrides,
})

describe('race registration course changes and historical snapshots', () => {
  it('captures the catalog temporal semantics and human-readable competitive context', () => {
    assert.deepEqual(createRaceRegistrationSnapshot(event, edition, course30k), {
      eventName: 'Ansilta XK',
      editionLabel: 'Ansilta XK 2026',
      editionDate: '2026-10-18',
      courseLabel: '30K',
      nominalDistanceKm: 30,
      nominalElevationGainM: 1650,
    } satisfies RaceRegistrationSnapshot)
  })

  it('changes course and snapshot together within the same edition before participation', () => {
    const changed = changeRaceRegistrationCourse(state(), event, edition, course42k)

    assert.equal(changed.course.raceCourseId, 'course_42k')
    assert.equal(changed.course.raceEditionId, 'edition_2026')
    assert.equal(changed.snapshot.courseLabel, '42K')
    assert.equal(changed.snapshot.nominalDistanceKm, 42)
    assert.equal(changed.snapshot.nominalElevationGainM, 2400)
  })

  it('rejects an ordinary course change to another edition', () => {
    const nextEdition: RaceEdition = { ...edition, id: 'edition_2027', label: 'Ansilta XK 2027', startDate: '2027-10-17' }
    const nextCourse: RaceCourse = { ...course30k, id: 'course_30k_2027', raceEditionId: nextEdition.id }

    assert.throws(
      () => changeRaceRegistrationCourse(state(), event, nextEdition, nextCourse),
      /different race edition/i,
    )
  })

  it('freezes ordinary course changes once participation evidence exists', () => {
    assert.throws(
      () => changeRaceRegistrationCourse(state({ participationStatus: 'started' }), event, edition, course42k),
      /participation evidence/i,
    )
    assert.throws(
      () => changeRaceRegistrationCourse(state({ participationStatus: 'dns' }), event, edition, course42k),
      /participation evidence/i,
    )
  })

  it('keeps the accepted snapshot independent from later catalog mutation', () => {
    const accepted = state()
    const laterCatalogCourse = { ...course30k, label: '30K updated', distanceKm: 31.2, elevationGainM: 1720 }

    assert.equal(laterCatalogCourse.distanceKm, 31.2)
    assert.deepEqual(accepted.snapshot, {
      eventName: 'Ansilta XK',
      editionLabel: 'Ansilta XK 2026',
      editionDate: '2026-10-18',
      courseLabel: '30K',
      nominalDistanceKm: 30,
      nominalElevationGainM: 1650,
    })
  })
})
