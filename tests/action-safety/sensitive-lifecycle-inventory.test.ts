import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const athleteTable = readFileSync('features/athletes/components/AthletesTable.tsx', 'utf8')
const registrationLifecycle = readFileSync('features/race-registration/components/RaceRegistrationLifecycleControl.tsx', 'utf8')
const courseChange = readFileSync('features/race-registration/components/RaceRegistrationCourseChange.tsx', 'utf8')
const workoutLog = readFileSync('features/workouts/components/LogWorkoutDialog.tsx', 'utf8')

test('known destructive lifecycle actions use the shared confirmation primitive', () => {
  assert.match(athleteTable, /ConfirmActionDialog/)
  assert.match(athleteTable, /deactivateConfirm/)
  assert.match(registrationLifecycle, /ConfirmActionDialog/)
  assert.match(registrationLifecycle, /variant=['"]destructive['"]/)
  assert.match(workoutLog, /ConfirmActionDialog/)
  assert.match(workoutLog, /variant=['"]destructive['"]/)
})

test('significant reversible course change uses contextual confirmation', () => {
  assert.match(courseChange, /ConfirmActionDialog/)
  assert.match(courseChange, /variant=['"]primary['"]/)
  assert.match(courseChange, /requestSubmit/)
})

test('lower-risk reactivation remains distinct from cancellation confirmation', () => {
  assert.match(registrationLifecycle, /registrationStatus === ['"]cancelled['"]/)
  assert.match(registrationLifecycle, /reactivateRegistration/)
  assert.match(registrationLifecycle, /value=['"]registered['"]/)
})
