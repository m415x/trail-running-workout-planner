import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const actions = readFileSync('app/actions/race-registration-actions.ts', 'utf8')
const repository = readFileSync(
  'lib/competitions/race-registration-repository.ts',
  'utf8',
)

describe('race participation server action contract', () => {
  it('keeps team scope server-owned and delegates explicit participation facts', () => {
    assert.match(actions, /export async function updateRaceParticipationAction/)
    assert.match(actions, /CURRENT_TEAM_ID/)
    assert.match(actions, /updateRaceParticipation\(/)
    assert.match(actions, /registrationId/)
    assert.match(actions, /participationStatus/)
    assert.match(actions, /actualDistanceKm/)
    assert.match(actions, /elapsedTimeSeconds/)
    assert.doesNotMatch(actions, /formData\.get\(['"]teamId['"]\)/)
  })

  it('loads the registration through a team-scoped repository lookup', () => {
    assert.match(repository, /export function getRaceRegistrationForTeam/)
    assert.match(repository, /eq\(raceRegistrations\.id, input\.registrationId\)/)
    assert.match(repository, /eq\(raceRegistrations\.teamId, input\.teamId\)/)
    assert.match(actions, /getRaceRegistrationForTeam/)
    assert.match(actions, /updateRaceRegistration/)
  })
})
