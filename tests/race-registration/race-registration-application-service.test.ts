import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  applyRaceParticipationCorrection,
  applyRaceParticipationEvidence,
  applyRaceRegistrationCourseChange,
  applyRaceRegistrationLifecycle,
  bulkRegisterAthletes,
} from '@/lib/competitions/race-registration-service'
import type {
  RaceRegistrationPersistenceInput,
  RaceResult,
} from '@/types/training/race-registration.types'

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

const target = {
  event: { id: 'event-1', name: 'Ansilta XK', status: 'active' as const },
  edition: {
    id: 'edition-1',
    raceEventId: 'event-1',
    label: 'Ansilta XK 2026',
    startDate: '2026-10-18',
    status: 'published' as const,
  },
  course: {
    id: 'course-30k',
    raceEditionId: 'edition-1',
    label: '30K',
    distanceKm: 30,
    elevationGainM: 1650,
    modality: null,
    classifications: [],
    status: 'published' as const,
  },
}

describe('race registration application service', () => {
  it('keeps bulk registration partial-success and revalidates every athlete independently', async () => {
    const created: string[] = []
    const result = await bulkRegisterAthletes(
      {
        teamId: 'team-1',
        athleteProfileIds: ['athlete-1', 'athlete-2', 'athlete-3'],
        target,
      },
      {
        createRegistration: async (input) => {
          if (input.athleteProfileId === 'athlete-2') {
            return {
              ok: false,
              reason: 'already_registered_in_edition',
              existingCourseLabel: '21K',
            }
          }
          created.push(input.athleteProfileId)
          return { ok: true, registrationId: input.id }
        },
        createId: (athleteProfileId) => `registration-${athleteProfileId}`,
      },
    )

    assert.deepEqual(created, ['athlete-1', 'athlete-3'])
    assert.deepEqual(result, {
      requested: 3,
      succeeded: 2,
      failed: 1,
      registrations: [
        { athleteProfileId: 'athlete-1', registrationId: 'registration-athlete-1' },
        { athleteProfileId: 'athlete-3', registrationId: 'registration-athlete-3' },
      ],
      failures: [
        {
          athleteProfileId: 'athlete-2',
          reason: 'already_registered_in_edition',
          existingCourseLabel: '21K',
        },
      ],
    })
  })

  it('changes course explicitly while preserving registration identity', () => {
    const changed = applyRaceRegistrationCourseChange(registration(), target)

    assert.equal(changed.id, 'registration-1')
    assert.equal(changed.course.raceCourseId, 'course-30k')
    assert.equal(changed.snapshot.courseLabel, '30K')
    assert.equal(changed.snapshot.nominalDistanceKm, 30)
    assert.equal(changed.snapshot.nominalElevationGainM, 1650)
  })

  it('cancels and reactivates registration without changing participation facts', () => {
    const cancelled = applyRaceRegistrationLifecycle(registration(), 'cancelled')
    assert.equal(cancelled.registrationStatus, 'cancelled')
    assert.equal(cancelled.participationStatus, 'unknown')

    const reactivated = applyRaceRegistrationLifecycle(cancelled, 'registered')
    assert.equal(reactivated.registrationStatus, 'registered')
    assert.equal(reactivated.participationStatus, 'unknown')
  })

  it('records ordinary participation evidence and keeps result facts explicit', () => {
    const result: RaceResult = { actualDistanceKm: 30.4, elapsedTimeSeconds: 10800 }
    const finished = applyRaceParticipationEvidence(registration(), 'finished', result)

    assert.equal(finished.participationStatus, 'finished')
    assert.deepEqual(finished.result, result)
  })

  it('requires explicit correction to replace known participation and result facts', () => {
    const current = registration({
      participationStatus: 'finished',
      result: { actualDistanceKm: 30.4, elapsedTimeSeconds: 10800 },
    })

    assert.throws(
      () => applyRaceParticipationEvidence(current, 'dnf', { actualDistanceKm: 20, elapsedTimeSeconds: null }),
      /explicit correction/i,
    )

    const corrected = applyRaceParticipationCorrection(current, 'dnf', {
      actualDistanceKm: 20,
      elapsedTimeSeconds: null,
    })
    assert.equal(corrected.participationStatus, 'dnf')
    assert.deepEqual(corrected.result, { actualDistanceKm: 20, elapsedTimeSeconds: null })
  })
})
