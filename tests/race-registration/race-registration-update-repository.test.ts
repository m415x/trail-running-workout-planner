import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const repository = readFileSync(
  'lib/competitions/race-registration-repository.ts',
  'utf8',
)

describe('race registration update persistence', () => {
  it('updates participation and result facts through an explicit team-scoped registration write', () => {
    assert.match(repository, /export function updateRaceRegistration/)
    assert.match(repository, /eq\(raceRegistrations\.id, input\.id\)/)
    assert.match(repository, /eq\(raceRegistrations\.teamId, input\.teamId\)/)
    assert.match(repository, /participationStatus:\s*record\.participationStatus/)
    assert.match(repository, /resultActualDistanceKm:\s*record\.result\?\.actualDistanceKm \?\? null/)
    assert.match(repository, /resultElapsedTimeSeconds:\s*record\.result\?\.elapsedTimeSeconds \?\? null/)
    assert.match(repository, /updatedAt:/)
  })
})
