import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  projectAthleteRaceCompetition,
  projectCourseRegistrationEligibility,
  summarizeBulkRaceRegistration,
} from '@/lib/competitions/race-registration-application'
import type { RaceRegistrationPersistenceInput } from '@/types/training/race-registration.types'

function registration(
  overrides: Partial<RaceRegistrationPersistenceInput> = {},
): RaceRegistrationPersistenceInput {
  return {
    id: 'registration-1',
    teamId: 'team-1',
    athleteProfileId: 'athlete-1',
    course: {
      raceEventId: 'event-1',
      raceEditionId: 'edition-1',
      raceCourseId: 'course-21k',
    },
    registrationStatus: 'registered',
    participationStatus: 'unknown',
    snapshot: {
      eventName: 'Ansilta XK',
      editionLabel: 'Ansilta XK 2026',
      editionDate: '2026-10-18',
      courseLabel: '21K',
      nominalDistanceKm: 21,
      nominalElevationGainM: 950,
    },
    result: null,
    ...overrides,
  }
}

describe('race registration application projections', () => {
  it('projects athlete-safe upcoming registrations without structural identities', () => {
    const projected = projectAthleteRaceCompetition([
      registration(),
      registration({
        id: 'registration-2',
        registrationStatus: 'cancelled',
        athleteProfileId: 'athlete-1',
      }),
    ])

    assert.deepEqual(projected.upcomingRegistrations, [
      {
        eventName: 'Ansilta XK',
        editionLabel: 'Ansilta XK 2026',
        editionDate: '2026-10-18',
        courseLabel: '21K',
        nominalDistanceKm: 21,
        nominalElevationGainM: 950,
      },
    ])
    assert.equal('teamId' in projected.upcomingRegistrations[0], false)
    assert.equal('athleteProfileId' in projected.upcomingRegistrations[0], false)
    assert.equal('raceCourseId' in projected.upcomingRegistrations[0], false)
  })

  it('projects factual race history while preserving unknown and known zero values', () => {
    const projected = projectAthleteRaceCompetition([
      registration({
        participationStatus: 'finished',
        result: { actualDistanceKm: 0, elapsedTimeSeconds: null },
      }),
    ])

    assert.deepEqual(projected.history, [
      {
        eventName: 'Ansilta XK',
        editionLabel: 'Ansilta XK 2026',
        editionDate: '2026-10-18',
        courseLabel: '21K',
        nominalDistanceKm: 21,
        nominalElevationGainM: 950,
        participationStatus: 'finished',
        actualDistanceKm: 0,
        elapsedTimeSeconds: null,
      },
    ])
  })

  it('separates course-first candidates into eligible, registered here and registered elsewhere', () => {
    const athletes = [
      { athleteProfileId: 'athlete-1', athleteName: 'Ana' },
      { athleteProfileId: 'athlete-2', athleteName: 'Juan' },
      { athleteProfileId: 'athlete-3', athleteName: 'Pedro' },
    ]
    const registrations = [
      registration({ athleteProfileId: 'athlete-1' }),
      registration({
        id: 'registration-2',
        athleteProfileId: 'athlete-2',
        course: {
          raceEventId: 'event-1',
          raceEditionId: 'edition-1',
          raceCourseId: 'course-30k',
        },
        snapshot: {
          eventName: 'Ansilta XK',
          editionLabel: 'Ansilta XK 2026',
          editionDate: '2026-10-18',
          courseLabel: '30K',
          nominalDistanceKm: 30,
          nominalElevationGainM: 1650,
        },
      }),
    ]

    assert.deepEqual(
      projectCourseRegistrationEligibility({
        athletes,
        registrations,
        raceEditionId: 'edition-1',
        raceCourseId: 'course-21k',
      }),
      {
        eligible: [{ athleteProfileId: 'athlete-3', athleteName: 'Pedro' }],
        registeredHere: [
          { athleteProfileId: 'athlete-1', athleteName: 'Ana', courseLabel: '21K' },
        ],
        registeredElsewhere: [
          { athleteProfileId: 'athlete-2', athleteName: 'Juan', courseLabel: '30K' },
        ],
      },
    )
  })

  it('summarizes partial bulk success without treating conflicts as course changes', () => {
    const result = summarizeBulkRaceRegistration({
      requestedAthleteProfileIds: ['athlete-1', 'athlete-2', 'athlete-3'],
      registrations: [
        { athleteProfileId: 'athlete-1', registrationId: 'registration-1' },
        { athleteProfileId: 'athlete-3', registrationId: 'registration-3' },
      ],
      failures: [
        {
          athleteProfileId: 'athlete-2',
          reason: 'already_registered_in_edition',
          existingCourseLabel: '30K',
        },
      ],
    })

    assert.deepEqual(result, {
      requested: 3,
      succeeded: 2,
      failed: 1,
      registrations: [
        { athleteProfileId: 'athlete-1', registrationId: 'registration-1' },
        { athleteProfileId: 'athlete-3', registrationId: 'registration-3' },
      ],
      failures: [
        {
          athleteProfileId: 'athlete-2',
          reason: 'already_registered_in_edition',
          existingCourseLabel: '30K',
        },
      ],
    })
  })
})
