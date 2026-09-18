import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { executeBulkRaceRegistration } from '@/lib/competitions/race-registration-command'

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
    id: 'course-21k',
    raceEditionId: 'edition-1',
    label: '21K',
    distanceKm: 21,
    elevationGainM: 950,
    modality: null,
    classifications: [],
    status: 'published' as const,
  },
}

describe('bulk race registration command boundary', () => {
  it('revalidates each submitted athlete against current edition registrations', async () => {
    const created: string[] = []
    const result = await executeBulkRaceRegistration(
      {
        teamId: 'team-1',
        athleteProfileIds: ['athlete-1', 'athlete-2'],
        target,
      },
      {
        findEffectiveRegistrationInEdition: async ({ athleteProfileId }) =>
          athleteProfileId === 'athlete-2'
            ? { registrationId: 'existing-2', courseLabel: '30K' }
            : null,
        persistRegistration: async (input) => {
          created.push(input.athleteProfileId)
          return input
        },
        createId: (athleteProfileId) => `registration-${athleteProfileId}`,
      },
    )

    assert.deepEqual(created, ['athlete-1'])
    assert.deepEqual(result, {
      requested: 2,
      succeeded: 1,
      failed: 1,
      registrations: [
        { athleteProfileId: 'athlete-1', registrationId: 'registration-athlete-1' },
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

  it('converts a uniqueness race discovered during persistence into one athlete failure', async () => {
    const result = await executeBulkRaceRegistration(
      {
        teamId: 'team-1',
        athleteProfileIds: ['athlete-1', 'athlete-2'],
        target,
      },
      {
        findEffectiveRegistrationInEdition: async () => null,
        persistRegistration: async (input) => {
          if (input.athleteProfileId === 'athlete-2') {
            const error = new Error('unique constraint')
            Object.assign(error, { code: 'SQLITE_CONSTRAINT_UNIQUE' })
            throw error
          }
          return input
        },
        findRegistrationInEdition: async ({ athleteProfileId }) =>
          athleteProfileId === 'athlete-2'
            ? { registrationId: 'concurrent-2', courseLabel: '30K' }
            : null,
        createId: (athleteProfileId) => `registration-${athleteProfileId}`,
      },
    )

    assert.equal(result.succeeded, 1)
    assert.equal(result.failed, 1)
    assert.deepEqual(result.failures, [
      {
        athleteProfileId: 'athlete-2',
        reason: 'already_registered_in_edition',
        existingCourseLabel: '30K',
      },
    ])
  })

  it('does not swallow unrelated persistence failures', async () => {
    await assert.rejects(
      () =>
        executeBulkRaceRegistration(
          { teamId: 'team-1', athleteProfileIds: ['athlete-1'], target },
          {
            findEffectiveRegistrationInEdition: async () => null,
            persistRegistration: async () => {
              throw new Error('database unavailable')
            },
            createId: () => 'registration-1',
          },
        ),
      /database unavailable/,
    )
  })
})
