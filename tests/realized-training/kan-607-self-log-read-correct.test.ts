import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/actions/realized-training-actions.ts', 'utf8')
function body(name: string) {
  const start = source.indexOf('export async function ' + name + '(')
  assert.ok(start >= 0, name)
  const rest = source.slice(start)
  const next = rest.indexOf('\nexport async function ', 20)
  return next < 0 ? rest : rest.slice(0, next)
}

test('KAN-702 session-state SELF read gates session locator before querying WorkoutLog', () => {
  const action = body('getManualRealizedSessionStateAction')
  assert.match(action, /requireAuthenticatedEptAction|createH5aSelfNextServerContext/)
  assert.match(action, /createH5aEffectiveSessionNextServerBoundary/)
  assert.match(action, /planning\.self\.read|effectiveSession\.resolve/)
  assert.match(action, /workoutLogs\.athleteId/)
})

test('KAN-702 range SELF read uses authenticated sporting identity, not legacy current athlete', () => {
  const action = body('getCurrentAthleteRealizedTrainingRangeAction')
  assert.match(action, /requireAuthenticatedEptAction|createH5aSelfNextServerContext/)
  assert.match(action, /planning\.self\.read|workout_log\.self\.manage/)
  assert.doesNotMatch(action, /getCurrentAthlete\(/)
  assert.match(action, /listRealizedTrainingRecordsForAthleteInDateRange/)
})

test('KAN-702 correction requires workout_log.self.manage and server-derived actor and owner', () => {
  const action = body('correctManualRealizedTrainingAction')
  assert.match(action, /requireAuthenticatedEptAction|createH5aSelfNextServerContext/)
  assert.match(action, /workout_log\.self\.manage|createManualSelfCorrectionBoundary/)
  assert.doesNotMatch(action, /getCurrentAthlete\(/)
  assert.match(action, /correctManualRealizedTrainingRecord/)
})
