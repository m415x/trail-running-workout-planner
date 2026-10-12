import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/actions/race-registration-actions.ts', 'utf8')

test('KAN-606 T8 form adapters must not swallow denied Coach competition writes', () => {
  const names = [
    'registerAthleteForRaceCourseFormAction',
    'changeRaceRegistrationCourseFormAction',
    'updateRaceRegistrationLifecycleFormAction',
    'updateRaceParticipationFormAction',
  ]
  for (const name of names) {
    const start = source.indexOf(`export async function ${name}(`)
    assert.ok(start >= 0, `${name} must exist`)
    const next = source.indexOf('\nexport async function ', start + 1)
    const body = source.slice(start, next < 0 ? undefined : next)
    assert.match(body, /if\s*\(!result\.ok\)/, `${name} must propagate failure to the form caller`)
    assert.match(body, /throw new Error\(/, `${name} must not treat denied mutation as successful submission`)
  }
})
