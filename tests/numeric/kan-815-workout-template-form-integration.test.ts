import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('features/workout-templates/components/WorkoutTemplateForm.tsx', 'utf8')

test('KAN-815 optional template metrics use regional normalizer on submission', () => {
  assert.match(source, /normalizeSessionPrescriptionMetricDraft/)
  assert.match(source, /formAction\(formData\)/)
  assert.match(source, /formData\.set/)
})

test('KAN-815 rejects malformed metrics prior to authorized action', () => {
  assert.match(source, /normalized\.status === 'invalid'/)
  assert.match(source, /setClientError/)
})

test('KAN-815 preserves template create and update and optional empty metrics', () => {
  assert.match(source, /createWorkoutTemplate/)
  assert.match(source, /updateWorkoutTemplate/)
  assert.match(source, /normalized\.status === 'valid' \? normalized\.value : ''/)
})

test('KAN-815 enables regional text keyboard for three metrics', () => {
  assert.match(source, /name='distanceKm'[^\n]*type='text' inputMode='decimal'/)
  assert.match(source, /name='durationMin'[^\n]*type='text' inputMode='numeric'/)
  assert.match(source, /name='elevationGain'[^\n]*type='text' inputMode='numeric'/)
})
