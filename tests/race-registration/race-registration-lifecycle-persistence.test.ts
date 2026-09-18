import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const repository = readFileSync('lib/competitions/race-registration-repository.ts', 'utf8')
const actions = readFileSync('app/actions/race-registration-actions.ts', 'utf8')

function functionBody(source: string, name: string) {
  const start = source.indexOf(`export function ${name}`)
  assert.notEqual(start, -1, `${name} must exist`)
  const nextExport = source.indexOf('\nexport ', start + 1)
  return source.slice(start, nextExport === -1 ? source.length : nextExport)
}

describe('KAN-366 registration lifecycle persistence', () => {
  it('persists course identity and historical snapshot together for explicit course changes', () => {
    const update = functionBody(repository, 'updateRaceRegistration')

    assert.match(update, /raceEventId:\s*record\.raceEventId/)
    assert.match(update, /raceEditionId:\s*record\.raceEditionId/)
    assert.match(update, /raceCourseId:\s*record\.raceCourseId/)
    assert.match(update, /snapshotEventName:\s*record\.snapshot\.eventName/)
    assert.match(update, /snapshotEditionLabel:\s*record\.snapshot\.editionLabel/)
    assert.match(update, /snapshotCourseLabel:\s*record\.snapshot\.courseLabel/)
    assert.match(update, /snapshotNominalDistanceKm:\s*record\.snapshot\.nominalDistanceKm/)
    assert.match(update, /snapshotNominalElevationGainM:\s*record\.snapshot\.nominalElevationGainM/)
  })

  it('exposes explicit scoped Coach actions for change-course and registration lifecycle transitions', () => {
    assert.match(actions, /changeRaceRegistrationCourseAction/)
    assert.match(actions, /updateRaceRegistrationLifecycleAction/)
    assert.match(actions, /getRaceRegistrationForTeam/)
    assert.match(actions, /applyRaceRegistrationCourseChange/)
    assert.match(actions, /applyRaceRegistrationLifecycle/)
    assert.match(actions, /updateRaceRegistration/)
  })
})
