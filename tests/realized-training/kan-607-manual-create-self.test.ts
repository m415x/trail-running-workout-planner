import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/actions/realized-training-actions.ts', 'utf8')
const boundary = readFileSync('lib/realized-training/manual-self-capture-boundary.ts', 'utf8')
const start = source.indexOf('export async function createManualRealizedTrainingAction(')
const end = source.indexOf('export async function correctManualRealizedTrainingAction(', start)
assert.ok(start >= 0 && end > start)
const create = source.slice(start, end)

test('KAN-701 manual write delegates H2 authentication and workout_log.self.manage to the SELF boundary', () => {
  assert.match(create, /requireAuthenticatedEptAction/)
  assert.match(create, /createH5aSelfNextServerContext/)
  assert.match(create, /createManualSelfCaptureBoundary\(/)
  assert.match(create, /resolveSelf:\s*\(authenticated, request\)\s*=>\s*selfContext\.resolve\(authenticated, request\)/)
  assert.match(boundary, /capability:\s*['"]workout_log\.self\.manage['"]/)
  assert.doesNotMatch(create, /CURRENT_USER_ID|CURRENT_ATHLETE_PROFILE_ID|profile_user_1|team_1/)
})

test('KAN-701 authoritative SELF owner is attached by boundary before the only persistence call', () => {
  assert.match(boundary, /athleteId:\s*self\.athleteProfileId/)
  assert.match(create, /persist:\s*\(capture\)\s*=>\s*createManualRealizedTrainingRecord\(capture\)/)
  assert.equal((create.match(/createManualRealizedTrainingRecord\(/g) ?? []).length, 1)
})

test('KAN-701 session locator requires effective SELF while free capture bypasses planning safely', () => {
  assert.match(create, /createH5aEffectiveSessionNextServerBoundary/)
  assert.match(create, /resolveEffectiveSession:/)
  assert.match(boundary, /input\.sessionId\s*===\s*null/)
  assert.match(boundary, /input\.workoutId\s*!==\s*null/)
  assert.match(boundary, /deps\.resolveEffectiveSession\(/)
  assert.match(create, /boundary\.create\(access, input,/)
})
