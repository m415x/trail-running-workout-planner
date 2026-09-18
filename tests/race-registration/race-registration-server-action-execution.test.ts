import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { executeRaceRegistrationServerAction } from '@/lib/competitions/race-registration-server-action-execution'

function request() {
  const formData = new FormData()
  formData.set('locale', 'es')
  formData.set('raceCourseId', 'course-21k')
  formData.append('athleteProfileId', 'athlete-1')
  formData.append('athleteProfileId', 'athlete-2')
  return formData
}

describe('race registration server action execution', () => {
  it('uses the trusted team, delegates the parsed request, and revalidates after mutation', async () => {
    const calls: string[] = []
    let delegated: unknown = null

    const result = await executeRaceRegistrationServerAction(request(), {
      teamId: 'team_1',
      runBulkRegistration: async (input) => {
        calls.push('mutate')
        delegated = input
        return { requested: 2, succeeded: 1, failed: 1, registrations: [], failures: [] }
      },
      revalidatePath: (path) => calls.push(`revalidate:${path}`),
    })

    assert.deepEqual(delegated, {
      teamId: 'team_1',
      raceCourseId: 'course-21k',
      submittedAthleteProfileIds: ['athlete-1', 'athlete-2'],
    })
    assert.deepEqual(calls, [
      'mutate',
      'revalidate:/[locale]/dashboard/competitions/[[...segments]]',
      'revalidate:/dashboard/athletes',
    ])
    assert.equal(result.succeeded, 1)
    assert.equal(result.failed, 1)
  })

  it('does not revalidate when parsing or mutation fails', async () => {
    const invalid = new FormData()
    invalid.set('locale', 'es')
    invalid.set('raceCourseId', '')
    const revalidated: string[] = []
    const recordRevalidation = (path: string) => { revalidated.push(path) }

    await assert.rejects(
      () => executeRaceRegistrationServerAction(invalid, {
        teamId: 'team_1',
        runBulkRegistration: async () => {
          throw new Error('must not execute')
        },
        revalidatePath: recordRevalidation,
      }),
      /invalid registration request/i,
    )
    assert.deepEqual(revalidated, [])

    await assert.rejects(
      () => executeRaceRegistrationServerAction(request(), {
        teamId: 'team_1',
        runBulkRegistration: async () => {
          throw new Error('mutation failed')
        },
        revalidatePath: recordRevalidation,
      }),
      /mutation failed/i,
    )
    assert.deepEqual(revalidated, [])
  })
})
