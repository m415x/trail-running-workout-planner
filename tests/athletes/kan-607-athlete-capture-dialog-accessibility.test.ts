import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const dialog = readFileSync('features/workouts/components/LogWorkoutDialog.tsx', 'utf8')

test('KAN-703 manual capture inputs have accessible labels, including individual duration units', () => {
  for (const field of ['distance', 'durationHours', 'durationMinutes', 'durationSeconds', 'elevationGain', 'averageHeartRate']) {
    assert.match(dialog, new RegExp('htmlFor=[\\x27\\x22]' + field + '[\\x27\\x22]'))
    assert.match(dialog, new RegExp('id=[\\x27\\x22]' + field + '[\\x27\\x22]'))
  }
})

test('KAN-703 error feedback is announced and dialog does not insert hidden keyboard stop', () => {
  assert.match(dialog, /role=['"]alert['"]/)
  assert.doesNotMatch(dialog, /tabIndex=\{0\} aria-hidden=['"]true['"]/)
})
