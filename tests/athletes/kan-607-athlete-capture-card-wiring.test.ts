import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const hook = readFileSync('features/workouts/hooks/useWorkoutCard.ts', 'utf8')
const card = readFileSync('features/workouts/components/WorkoutCard.tsx', 'utf8')
const es = JSON.parse(readFileSync('messages/es/realized-training/workouts.json', 'utf8'))
const en = JSON.parse(readFileSync('messages/en/realized-training/workouts.json', 'utf8'))

test('KAN-703 hook represents loading, denied, and error rather than silently disabling capture', () => {
  assert.match(hook, /resolveAthleteCaptureUiState/)
  assert.match(hook, /captureUiState/)
  assert.match(hook, /setCaptureUiState/)
  assert.match(hook, /status:\s*['"]denied['"]|kind:\s*['"]response['"]/)
  assert.match(hook, /kind:\s*['"]error['"]/)
})

test('KAN-703 WorkoutCard explains blocked capture states with accessible, localized status', () => {
  assert.match(card, /captureUiState/)
  assert.match(card, /role=['"]status['"]|role=['"]alert['"]/)
  assert.match(card, /captureState\.loading|captureState\.denied|captureState\.error/)
  for (const messages of [es, en]) {
    assert.equal(typeof messages.Workouts?.captureState?.loading, 'string')
    assert.equal(typeof messages.Workouts?.captureState?.denied, 'string')
    assert.equal(typeof messages.Workouts?.captureState?.error, 'string')
  }
})
