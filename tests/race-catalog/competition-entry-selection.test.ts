import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { selectRaceCourseForCompetition } from '@/lib/race-catalog/competition-entry-selection'
import type {
  RaceCourse,
  RaceEdition,
  RaceEvent,
} from '@/types/training/race-catalog.types'

const createdAt = '2026-09-13T12:00:00.000Z'

function event(overrides: Partial<RaceEvent> = {}): RaceEvent {
  return {
    id: 'event-1',
    name: 'Patagonia Run',
    status: 'active',
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
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
    createdAt,
    updatedAt: createdAt,
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
    classifications: [{
      systemId: 'itra.endurance_points',
      authority: 'ITRA',
      dimension: 'endurance_difficulty',
      versionRef: 'current-2026-09-13',
      code: '2',
      provenance: 'derived_from_source_rules',
    }],
    scheduledStartAt: '2027-04-10T06:00:00-03:00',
    status: 'published',
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  }
}

describe('race course -> CompetitionEntry selection', () => {
  it('copies the concrete course into a plan-owned snapshot and stable reference', () => {
    const result = selectRaceCourseForCompetition({
      event: event(),
      edition: edition(),
      course: course(),
      groupTrainingPlanId: 'plan-1',
      priority: 'A',
      status: 'confirmed',
    })

    assert.equal(result.valid, true)
    if (!result.valid) return

    assert.deepEqual(result.selection.reference, {
      raceEventId: 'event-1',
      raceEditionId: 'edition-2027',
      raceCourseId: 'course-42k',
    })
    assert.deepEqual(result.selection.competitionDraft, {
      groupTrainingPlanId: 'plan-1',
      name: 'Patagonia Run — 42K',
      date: '2027-04-10',
      distanceKm: 42.2,
      elevationGainM: 2_350,
      priority: 'A',
      status: 'confirmed',
      description: null,
    })
  })

  it('falls back to the edition start date when a course start is not known', () => {
    const result = selectRaceCourseForCompetition({
      event: event(),
      edition: edition(),
      course: course({ scheduledStartAt: null }),
      groupTrainingPlanId: 'plan-1',
      priority: 'B',
    })

    assert.equal(result.valid, true)
    if (result.valid) assert.equal(result.selection.competitionDraft.date, '2027-04-09')
  })

  it('rejects mismatched ancestry rather than inferring it from labels', () => {
    const result = selectRaceCourseForCompetition({
      event: event(),
      edition: edition({ raceEventId: 'another-event' }),
      course: course(),
      groupTrainingPlanId: 'plan-1',
      priority: 'A',
    })

    assert.equal(result.valid, false)
    if (!result.valid) assert.ok(result.errors.includes('race_catalog_ancestry_mismatch'))
  })

  it('requires an active/published catalog path for new selection', () => {
    const result = selectRaceCourseForCompetition({
      event: event(),
      edition: edition({ status: 'completed' }),
      course: course(),
      groupTrainingPlanId: 'plan-1',
      priority: 'A',
    })

    assert.equal(result.valid, false)
    if (!result.valid) assert.deepEqual(result.errors, ['race_catalog_edition_unavailable'])
  })

  it('does not create a CompetitionEntry when course distance is unknown', () => {
    const result = selectRaceCourseForCompetition({
      event: event(),
      edition: edition(),
      course: course({ distanceKm: null }),
      groupTrainingPlanId: 'plan-1',
      priority: 'A',
    })

    assert.equal(result.valid, false)
    if (!result.valid) assert.deepEqual(result.errors, ['race_catalog_course_distance_unknown'])
  })

  it('copies nested catalog metadata so later live edits cannot mutate the accepted snapshot', () => {
    const liveCourse = course()
    const result = selectRaceCourseForCompetition({
      event: event(),
      edition: edition(),
      course: liveCourse,
      groupTrainingPlanId: 'plan-1',
      priority: 'A',
    })

    assert.equal(result.valid, true)
    if (!result.valid) return

    liveCourse.modality = { code: 'road' }
    liveCourse.classifications[0] = {
      ...liveCourse.classifications[0],
      code: '6',
    }
    liveCourse.distanceKm = 50

    assert.equal(result.selection.snapshot.distanceKm, 42.2)
    assert.deepEqual(result.selection.snapshot.modality, { code: 'trail' })
    assert.equal(result.selection.snapshot.classifications[0]?.code, '2')
    assert.equal(result.selection.competitionDraft.distanceKm, 42.2)
  })
})
