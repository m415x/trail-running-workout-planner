import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { runBulkRaceRegistrationAction } from '@/lib/competitions/race-registration-action-service'

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

describe('bulk race registration action orchestration', () => {
  it('resolves the current catalog hierarchy and delegates only sanitized athlete ids', async () => {
    let delegated: unknown = null

    const result = await runBulkRaceRegistrationAction(
      {
        teamId: 'team-1',
        raceCourseId: 'course-21k',
        submittedAthleteProfileIds: ['athlete-1', 'stale', 'athlete-1', 'athlete-2'],
      },
      {
        getRaceCourse: () => course,
        getRaceEdition: () => edition,
        getRaceEvent: () => event,
        listSelectableAthleteProfileIds: async () => ['athlete-1', 'athlete-2'],
        executeBulkRegistration: async (input) => {
          delegated = input
          return { requested: 2, succeeded: 2, failed: 0, registrations: [], failures: [] }
        },
      },
    )

    assert.deepEqual(delegated, {
      teamId: 'team-1',
      athleteProfileIds: ['athlete-1', 'athlete-2'],
      target: { event, edition, course },
    })
    assert.equal(result.succeeded, 2)
  })

  it('rejects a stale or inconsistent catalog hierarchy before registration', async () => {
    await assert.rejects(
      () => runBulkRaceRegistrationAction(
        {
          teamId: 'team-1',
          raceCourseId: 'course-21k',
          submittedAthleteProfileIds: ['athlete-1'],
        },
        {
          getRaceCourse: () => course,
          getRaceEdition: () => ({ ...edition, id: 'edition-other' }),
          getRaceEvent: () => event,
          listSelectableAthleteProfileIds: async () => ['athlete-1'],
          executeBulkRegistration: async () => {
            throw new Error('must not execute')
          },
        },
      ),
      /catalog hierarchy/i,
    )
  })

  it('rejects a request when no submitted athlete remains selectable', async () => {
    await assert.rejects(
      () => runBulkRaceRegistrationAction(
        {
          teamId: 'team-1',
          raceCourseId: 'course-21k',
          submittedAthleteProfileIds: ['stale-athlete'],
        },
        {
          getRaceCourse: () => course,
          getRaceEdition: () => edition,
          getRaceEvent: () => event,
          listSelectableAthleteProfileIds: async () => ['athlete-1'],
          executeBulkRegistration: async () => ({
            requested: 0,
            succeeded: 0,
            failed: 0,
            registrations: [],
            failures: [],
          }),
        },
      ),
      /no eligible athletes/i,
    )
  })
})
