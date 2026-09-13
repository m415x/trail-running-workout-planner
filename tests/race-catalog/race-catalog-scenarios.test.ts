import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { selectRaceCourseForCompetition } from '@/lib/race-catalog/competition-entry-selection'
import { deriveRaceCourseProfile } from '@/lib/race-catalog/race-course-derived-profile'
import type {
  RaceCourse,
  RaceCourseClassification,
  RaceEdition,
  RaceEvent,
} from '@/types/training/race-catalog.types'

const CREATED_AT = '2027-01-01T00:00:00.000Z'

function event(overrides: Partial<RaceEvent> = {}): RaceEvent {
  return {
    id: 'event-patagonia-run',
    isDeleted: false,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    name: 'Patagonia Run',
    websiteUrl: null,
    description: null,
    status: 'active',
    source: { origin: 'product' },
    ...overrides,
  }
}

function edition(overrides: Partial<RaceEdition> = {}): RaceEdition {
  return {
    id: 'edition-2027',
    isDeleted: false,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    raceEventId: 'event-patagonia-run',
    label: 'Patagonia Run 2027',
    startDate: '2027-04-10',
    endDate: '2027-04-11',
    organizerName: 'Patagonia Eventos',
    location: { locality: 'San Martín de los Andes', region: 'Neuquén', countryCode: 'AR' },
    websiteUrl: null,
    notes: null,
    status: 'published',
    source: { origin: 'product' },
    ...overrides,
  }
}

function classification(
  overrides: Partial<RaceCourseClassification> = {},
): RaceCourseClassification {
  return {
    systemId: 'itra-distance-category',
    authority: 'ITRA',
    dimension: 'distance_category',
    versionRef: '2026',
    code: 'M',
    label: 'Medium',
    provenance: 'manual_reference',
    sourceUrl: null,
    assessedAt: '2027-01-01',
    ...overrides,
  }
}

function course(overrides: Partial<RaceCourse> = {}): RaceCourse {
  return {
    id: 'course-42k',
    isDeleted: false,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    raceEditionId: 'edition-2027',
    label: '42K',
    distanceKm: 42,
    elevationGainM: 2500,
    modality: { code: 'trail' },
    classifications: [classification()],
    scheduledStartAt: '2027-04-11T08:00:00-03:00',
    startLocationLabel: 'San Martín de los Andes',
    notes: null,
    status: 'published',
    source: { origin: 'product' },
    ...overrides,
  }
}

describe('race catalog end-to-end domain scenarios', () => {
  it('models one multidistance event as one event + one edition + distinct courses', () => {
    const raceEvent = event()
    const raceEdition = edition()
    const courses = [
      course({ id: 'course-12k', label: '12K', distanceKm: 12, elevationGainM: 450 }),
      course({ id: 'course-21k', label: '21K', distanceKm: 21, elevationGainM: 950 }),
      course({ id: 'course-42k', label: '42K', distanceKm: 42, elevationGainM: 2500 }),
    ]

    assert.equal(raceEdition.raceEventId, raceEvent.id)
    assert.equal(new Set(courses.map(({ raceEditionId }) => raceEditionId)).size, 1)
    assert.equal(courses.every(({ raceEditionId }) => raceEditionId === raceEdition.id), true)
    assert.deepEqual(courses.map(({ label }) => label), ['12K', '21K', '42K'])
    assert.equal(new Set(courses.map(({ id }) => id)).size, 3)
  })

  it('keeps editions independent when the same event changes course distance or D+', () => {
    const edition2027 = edition()
    const edition2028 = edition({
      id: 'edition-2028',
      label: 'Patagonia Run 2028',
      startDate: '2028-04-08',
      endDate: '2028-04-09',
    })
    const course2027 = course({
      id: 'course-42k-2027',
      raceEditionId: edition2027.id,
      distanceKm: 42,
      elevationGainM: 2500,
    })
    const course2028 = course({
      id: 'course-42k-2028',
      raceEditionId: edition2028.id,
      distanceKm: 43.5,
      elevationGainM: 2700,
    })

    assert.equal(edition2027.raceEventId, edition2028.raceEventId)
    assert.notEqual(course2027.raceEditionId, course2028.raceEditionId)
    assert.notEqual(course2027.id, course2028.id)
    assert.notEqual(course2027.distanceKm, course2028.distanceKm)
    assert.notEqual(course2027.elevationGainM, course2028.elevationGainM)
  })

  it('distinguishes equal nominal distances by profile instead of treating distance as identity', () => {
    const runnable = course({
      id: 'course-21k-runnable',
      label: '21K Corrible',
      distanceKm: 21,
      elevationGainM: 500,
      modality: { code: 'trail' },
    })
    const technical = course({
      id: 'course-21k-technical',
      label: '21K Técnico',
      distanceKm: 21,
      elevationGainM: 1900,
      modality: { code: 'skyrunning' },
    })

    const runnableProfile = deriveRaceCourseProfile(runnable)
    const technicalProfile = deriveRaceCourseProfile(technical)

    assert.equal(runnable.distanceKm, technical.distanceKm)
    assert.notEqual(runnable.id, technical.id)
    assert.notEqual(runnableProfile.elevationDensityMPerKm, technicalProfile.elevationDensityMPerKm)
    assert.notEqual(runnableProfile.kilometerEffortKm, technicalProfile.kilometerEffortKm)
    assert.equal(technicalProfile.kilometerEffortKm! > runnableProfile.kilometerEffortKm!, true)
  })

  it('supports route, trail, skyrunning, ultra and vertical kilometer without inferring modality from D+', () => {
    const profiles = [
      course({ id: 'road-10k', label: 'Ruta 10K', distanceKm: 10, elevationGainM: 40, modality: { code: 'road' } }),
      course({ id: 'trail-21k', label: 'Trail 21K', distanceKm: 21, elevationGainM: 900, modality: { code: 'trail' } }),
      course({ id: 'sky-30k', label: 'Sky 30K', distanceKm: 30, elevationGainM: 2800, modality: { code: 'skyrunning' } }),
      course({ id: 'ultra-100k', label: 'Ultra 100K', distanceKm: 100, elevationGainM: 5200, modality: { code: 'trail' } }),
      course({ id: 'vk', label: 'KV', distanceKm: 4.8, elevationGainM: 1000, modality: { code: 'vertical_kilometer' } }),
    ]

    assert.deepEqual(
      profiles.map(({ modality }) => modality?.code),
      ['road', 'trail', 'skyrunning', 'trail', 'vertical_kilometer'],
    )
    assert.equal(deriveRaceCourseProfile(profiles[4]).elevationDensityMPerKm! > 200, true)
    assert.equal(profiles[4].modality?.code, 'vertical_kilometer')
  })

  it('keeps classifications versioned and allows absence without inventing one', () => {
    const unclassified = course({ classifications: [] })
    const classified = course({
      classifications: [
        classification({ systemId: 'itra-distance-category', versionRef: '2026', code: 'M' }),
        classification({
          systemId: 'itra-distance-category',
          versionRef: '2027',
          code: 'M',
          provenance: 'declared_by_source',
        }),
      ],
    })

    assert.deepEqual(unclassified.classifications, [])
    assert.equal(classified.classifications.length, 2)
    assert.deepEqual(
      classified.classifications.map(({ versionRef }) => versionRef),
      ['2026', '2027'],
    )
  })

  it('copies an immutable CompetitionEntry snapshot so later catalog edits do not rewrite planning history', () => {
    const raceEvent = event()
    const raceEdition = edition()
    const selectedCourse = course({
      id: 'course-42k-2027',
      label: '42K',
      distanceKm: 42,
      elevationGainM: 2500,
    })

    const selected = selectRaceCourseForCompetition({
      event: raceEvent,
      edition: raceEdition,
      course: selectedCourse,
      groupTrainingPlanId: 'plan-1',
      priority: 'A',
      status: 'confirmed',
    })

    assert.equal(selected.valid, true)
    if (!selected.valid) return

    const originalSnapshot = structuredClone(selected.selection.snapshot)
    const editedCatalogCourse: RaceCourse = {
      ...selectedCourse,
      label: '42K recorrido actualizado',
      distanceKm: 43.5,
      elevationGainM: 2700,
      classifications: [classification({ versionRef: '2028', code: 'L' })],
      updatedAt: '2028-01-01T00:00:00.000Z',
    }

    assert.equal(editedCatalogCourse.distanceKm, 43.5)
    assert.deepEqual(selected.selection.snapshot, originalSnapshot)
    assert.equal(selected.selection.competitionDraft.distanceKm, 42)
    assert.equal(selected.selection.competitionDraft.elevationGainM, 2500)
    assert.deepEqual(selected.selection.reference, {
      raceEventId: raceEvent.id,
      raceEditionId: raceEdition.id,
      raceCourseId: selectedCourse.id,
    })
  })
})
