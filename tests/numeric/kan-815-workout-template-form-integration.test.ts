import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('features/workout-templates/components/WorkoutTemplateForm.tsx', 'utf8')
const boundary = readFileSync('lib/numeric/template-numeric-submit-boundary.ts', 'utf8')

test('KAN-815 optional template metrics use regional submission boundary', () => {
  assert.match(source, /submitValidatedTemplateNumericDraft\(formData, intensityMethod,/)
  assert.match(source, /formAction\(payload\)/)
  assert.match(boundary, /normalizeSessionPrescriptionMetricDraft/)
  assert.match(boundary, /canonical\.set\(key, value\)/)
})

test('KAN-815 rejects malformed metrics prior to authorized action', () => {
  assert.match(boundary, /if \(parsed\.status === 'invalid'\) return 'invalid'/)
  assert.match(source, /if \(result === 'invalid'\)/)
  assert.match(source, /setClientError\(true\)/)
})

test('KAN-815 preserves template create and update and optional empty metrics', () => {
  assert.match(source, /createWorkoutTemplate/)
  assert.match(source, /updateWorkoutTemplate/)
  assert.match(boundary, /parsed\.status === 'valid' \? parsed\.value : ''/)
})

test('KAN-815 enables regional text keyboard for three metrics', () => {
  assert.match(source, /name='distanceKm'[^\n]*type='text' inputMode='decimal'/)
  assert.match(source, /name='durationMin'[^\n]*type='text' inputMode='numeric'/)
  assert.match(source, /name='elevationGain'[^\n]*type='text' inputMode='numeric'/)
})
