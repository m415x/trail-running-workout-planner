import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildRaceRegistrationActionDependencies } from '@/lib/competitions/race-registration-server-action-wiring'

const event = { id: 'event-1', name: 'Ansilta XK' }
const edition = {
  id: 'edition-1',
  raceEventId: 'event-1',
  label: 'Ansilta XK 2026',
  startDate: '2026-10-18',
}
const course = {
  id: 'course-21k',
  raceEditionId: 'edition-1',
  label: '21K',
  distanceKm: 21,
  elevationGainM: 950,
}

describe('race registration server action wiring', () => {
  it('derives selectable athletes from active team athletes without an edition registration', async () => {
    const dependencies = buildRaceRegistrationActionDependencies({
      getRaceCourse: () => course,
      getRaceEdition: () => edition,
      getRaceEvent: () => event,
      listActiveAthleteProfileIds: async (teamId) => {
        assert.equal(teamId, 'team-1')
        return ['athlete-1', 'athlete-2', 'athlete-3']
      },
      findRaceRegistrationInEdition: ({ athleteProfileId }) =>
        athleteProfileId === 'athlete-2'
          ? { registrationId: 'registration-2', courseLabel: '30K', registrationStatus: 'registered' }
          : null,
      createRaceRegistration: (input) => input,
      createId: (athleteProfileId) => `registration-${athleteProfileId}`,
    })

    assert.deepEqual(
      await dependencies.listSelectableAthleteProfileIds({ teamId: 'team-1', raceEditionId: 'edition-1' }),
      ['athlete-1', 'athlete-3'],
    )
  })

  it('wires the bulk command to repository lookup and persistence', async () => {
    const persisted: string[] = []
    const dependencies = buildRaceRegistrationActionDependencies({
      getRaceCourse: () => course,
      getRaceEdition: () => edition,
      getRaceEvent: () => event,
      listActiveAthleteProfileIds: async () => ['athlete-1'],
      findRaceRegistrationInEdition: () => null,
      createRaceRegistration: (input) => {
        persisted.push(input.athleteProfileId)
        return input
      },
      createId: (athleteProfileId) => `registration-${athleteProfileId}`,
    })

    const result = await dependencies.executeBulkRegistration({
      teamId: 'team-1',
      athleteProfileIds: ['athlete-1'],
      target: { event, edition, course },
    })

    assert.deepEqual(persisted, ['athlete-1'])
    assert.equal(result.succeeded, 1)
    assert.equal(result.failed, 0)
  })
})
