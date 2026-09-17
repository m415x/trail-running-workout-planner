import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const repository = readFileSync('lib/competitions/race-registration-repository.ts', 'utf8')
const actions = readFileSync('app/actions/race-registration-actions.ts', 'utf8')

describe('KAN-366 registration lifecycle persistence', () => {
  it('persists course identity and historical snapshot together for explicit course changes', () => {
    assert.match(repository, /raceEventId:\s*record\.raceEventId/)
    assert.match(repository, /raceEditionId:\s*record\.raceEditionId/)
    assert.match(repository, /raceCourseId:\s*record\.raceCourseId/)
    assert.match(repository, /snapshotEventName:\s*record\.snapshot\.eventName/)
    assert.match(repository, /snapshotEditionLabel:\s*record\.snapshot\.editionLabel/)
    assert.match(repository, /snapshotCourseLabel:\s*record\.snapshot\.courseLabel/)
    assert.match(repository, /snapshotNominalDistanceKm:\s*record\.snapshot\.nominalDistanceKm/)
    assert.match(repository, /snapshotNominalElevationGainM:\s*record\.snapshot\.nominalElevationGainM/)
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
