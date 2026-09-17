import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const actions = readFileSync('app/actions/race-registration-actions.ts', 'utf8')
const serverAction = readFileSync('lib/competitions/race-registration-server-action.ts', 'utf8')

describe('KAN-366 locale-aware race registration mutation revalidation', () => {
  it('uses the established locale-aware revalidation contract for individual registration', () => {
    assert.match(actions, /raceRegistrationRevalidationPaths/)
    assert.match(actions, /formData\.get\(['"]locale['"]\)/)
    assert.match(actions, /registerAthleteForRaceCourseAction[\s\S]*raceRegistrationRevalidationPaths/)
    assert.doesNotMatch(actions, /registerAthleteForRaceCourseAction[\s\S]*revalidatePath\(['"]\/dashboard\/competitions['"]\)/)
  })

  it('revalidates lifecycle, course-change, and participation mutations through locale-aware paths', () => {
    assert.match(serverAction, /raceRegistrationRevalidationPaths/)
    for (const actionName of [
      'changeRaceRegistrationCourseAction',
      'updateRaceRegistrationLifecycleAction',
      'updateRaceParticipationAction',
    ]) {
      const start = actions.indexOf(`export async function ${actionName}`)
      assert.notEqual(start, -1)
      const next = actions.indexOf('export async function ', start + 1)
      const body = actions.slice(start, next === -1 ? undefined : next)
      assert.match(body, /formData\.get\(['"]locale['"]\)/)
      assert.match(body, /raceRegistrationRevalidationPaths/)
      assert.doesNotMatch(body, /revalidatePath\(['"]\/dashboard\/competitions['"]\)/)
    }
  })
})
