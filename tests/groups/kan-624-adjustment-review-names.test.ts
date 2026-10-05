import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

test('KAN-624 adjustment review projects administrative names without changing planning resolution', () => {
  const value = fs.readFileSync('app/actions/athlete-session-adjustment-actions.ts', 'utf8')
  assert.match(value, /projectAthleteAdministrativeRead\(athlete\)/)
  assert.doesNotMatch(value, /athlete\.user\.(?:firstName|lastName)/)
  assert.match(value, /resolveEffectiveAthleteAdjustment/)
  assert.match(value, /resolveAthleteSessionPrescription/)
  assert.match(value, /resolveAthletePlanningOnDate/)
})
