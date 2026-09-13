import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { selectRaceCourseForTrainingGoal } from '@/lib/race-catalog/training-goal-selection'
import type { RaceCourse, RaceEdition, RaceEvent } from '@/types/training/race-catalog.types'

const now = '2026-09-13T12:00:00.000Z'

function event(overrides: Partial<RaceEvent> = {}): RaceEvent {
  return {
    id: 'event-1',
    name: 'Patagonia Run',
    status: 'active',
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function edition(overrides: Partial<RaceEdition> = {}): RaceEdition {
  return {
    id: 'edition-2027',
    raceEventId: 'event-1',
    label: '2027',
    startDate: '2027-04-09',
    endDate: '2027-04-11',
    status: 'published',
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function course(overrides: Partial<RaceCourse> = {}): RaceCourse {
  return {
    id: 'course-42k',
    raceEditionId: 'edition-2027',
    label: '42K',
    distanceKm: 42.2,
    elevationGainM: 2_350,
    modality: { code: 'trail' },
    classifications: [],
    scheduledStartAt: '2027-04-10T06:00:00-03:00',
    status: 'published',
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('race course -> TrainingGoal selection', () => {
  it('copies course context into the existing athlete goal snapshot fields', () => {
    const result = selectRaceCourseForTrainingGoal({
      event: event(),
      edition: edition(),
      course: course(),
    })

    assert.equal(result.valid, true)
    if (!result.valid) return

    assert.deepEqual(result.selection.reference, {
      raceEventId: 'event-1',
      raceEditionId: 'edition-2027',
      raceCourseId: 'course-42k',
    })
    assert.deepEqual(result.selection.goalPatch, {
      targetDate: '2027-04-10',
      raceName: 'Patagonia Run — 42K',
      raceDistanceKm: 42.2,
      raceElevationGain: 2_350,
    })
  })

  it('keeps unknown D+ unknown instead of replacing it with zero', () => {
    const result = selectRaceCourseForTrainingGoal({
      event: event(),
      edition: edition(),
      course: course({ elevationGainM: null }),
    })

    assert.equal(result.valid, true)
    if (result.valid) assert.equal(result.selection.goalPatch.raceElevationGain, null)
  })

  it('falls back to edition start date when the course schedule is unknown', () => {
    const result = selectRaceCourseForTrainingGoal({
      event: event(),
      edition: edition(),
      course: course({ scheduledStartAt: null }),
    })

    assert.equal(result.valid, true)
    if (result.valid) assert.equal(result.selection.goalPatch.targetDate, '2027-04-09')
  })

  it('reuses the same live-catalog selectability policy as CompetitionEntry', () => {
    const result = selectRaceCourseForTrainingGoal({
      event: event(),
      edition: edition({ status: 'completed' }),
      course: course(),
    })

    assert.equal(result.valid, false)
    if (!result.valid) assert.deepEqual(result.errors, ['race_catalog_edition_unavailable'])
  })

  it('requires known distance because a race TrainingGoal snapshot requires it', () => {
    const result = selectRaceCourseForTrainingGoal({
      event: event(),
      edition: edition(),
      course: course({ distanceKm: null }),
    })

    assert.equal(result.valid, false)
    if (!result.valid) assert.deepEqual(result.errors, ['race_catalog_course_distance_unknown'])
  })

  it('produces detached scalar snapshot data rather than a live catalog dependency', () => {
    const liveCourse = course()
    const result = selectRaceCourseForTrainingGoal({
      event: event(),
      edition: edition(),
      course: liveCourse,
    })

    assert.equal(result.valid, true)
    if (!result.valid) return

    liveCourse.distanceKm = 50
    liveCourse.elevationGainM = 3_000
    liveCourse.label = '50K'

    assert.deepEqual(result.selection.goalPatch, {
      targetDate: '2027-04-10',
      raceName: 'Patagonia Run — 42K',
      raceDistanceKm: 42.2,
      raceElevationGain: 2_350,
    })
  })
})
