import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/actions/realized-training-actions.ts', 'utf8')
const start = source.indexOf('export async function createManualRealizedTrainingAction(')
const end = source.indexOf('export async function correctManualRealizedTrainingAction(', start)
assert.ok(start >= 0 && end > start)
const create = source.slice(start, end)

test('KAN-701 manual write authorizes workout_log.self.manage from authenticated H2/active Team, not planning read', () => {
  assert.match(create, /requireAuthenticatedEptAction/)
  assert.match(create, /createH5aSelfNextServerContext/)
  assert.match(create, /capability:\s*['"]workout_log\.self\.manage['"]/)
  assert.doesNotMatch(create, /CURRENT_USER_ID|CURRENT_ATHLETE_PROFILE_ID|profile_user_1|team_1/)
})

test('KAN-701 persisted SELF owner replaces every untrusted client athleteId before writing', () => {
  assert.match(create, /self\.athleteProfileId/)
  assert.match(create, /createManualRealizedTrainingRecord/)
  assert.match(create, /athleteId:\s*self\.athleteProfileId/)
})

test('KAN-701 selected session locator must be effective SELF but free sessionId null remains valid', () => {
  assert.match(create, /createH5aEffectiveSessionNextServerBoundary/)
  assert.match(create, /sessionId\s*!==\s*null|sessionId\s*===\s*null/)
  assert.match(create, /\.resolve\(/)
  assert.match(create, /success:\s*false/)
})
