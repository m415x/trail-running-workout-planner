import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  updateRaceParticipation,
  type UpdateRaceParticipationDependencies,
} from '../../lib/competitions/race-registration-service'
import type { RaceRegistrationPersistenceInput } from '../../types/training/race-registration.types'

const registration: RaceRegistrationPersistenceInput = {
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
    editionDate: '2026-09-20',
    courseLabel: '30K',
    nominalDistanceKm: 30,
    nominalElevationGainM: 1200,
  },
  result: null,
}

describe('race participation correction command', () => {
  it('loads within team scope, applies explicit correction, and persists factual result values', async () => {
    let persisted: RaceRegistrationPersistenceInput | null = null
    const dependencies: UpdateRaceParticipationDependencies = {
      getRegistration: (input) => {
        assert.deepEqual(input, { teamId: 'team_1', registrationId: 'registration_1' })
        return registration
      },
      updateRegistration: (input) => {
        persisted = input
        return input
      },
    }

    const result = await updateRaceParticipation(
      {
        teamId: 'team_1',
        registrationId: 'registration_1',
        participationStatus: 'dnf',
        actualDistanceKm: 0,
        elapsedTimeSeconds: null,
      },
      dependencies,
    )

    assert.equal(result.ok, true)
    assert.equal(persisted?.participationStatus, 'dnf')
    assert.equal(persisted?.result?.actualDistanceKm, 0)
    assert.equal(persisted?.result?.elapsedTimeSeconds, null)
  })

  it('returns not_found without writing when the scoped registration is absent', async () => {
    let writes = 0
    const dependencies: UpdateRaceParticipationDependencies = {
      getRegistration: () => null,
      updateRegistration: () => {
        writes += 1
        return null
      },
    }

    const result = await updateRaceParticipation(
      {
        teamId: 'team_other',
        registrationId: 'registration_1',
        participationStatus: 'dns',
        actualDistanceKm: null,
        elapsedTimeSeconds: null,
      },
      dependencies,
    )

    assert.deepEqual(result, { ok: false, reason: 'not_found' })
    assert.equal(writes, 0)
  })
})
