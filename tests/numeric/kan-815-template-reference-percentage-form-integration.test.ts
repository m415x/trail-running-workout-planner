import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const form = readFileSync('features/workout-templates/components/WorkoutTemplateForm.tsx', 'utf8')

test('KAN-815/A2 reference percentage is normalized only for active percentage intensity', () => {
  assert.match(form, /normalizeTemplateReferencePercentageDraft/)
  assert.match(form, /intensityMethod === 'reference_percentage'/)
  assert.match(form, /formData\.get\('referencePercentage'\)/)
  assert.match(form, /formData\.set\('referencePercentage',/)
})

test('KAN-815/A2 rejects malformed active percentage and preserves existing action', () => {
  assert.match(form, /normalizedPercentage\.status !== 'valid'/)
  assert.match(form, /setClientError\(true\)/)
  assert.match(form, /formAction\(formData\)/)
})

test('KAN-815/A2 keeps regional input usable and does not require inactive percentage', () => {
  assert.match(form, /name='referencePercentage'[^\n]*type='text' inputMode='decimal'/)
  assert.match(form, /createWorkoutTemplate/)
  assert.match(form, /updateWorkoutTemplate/)
})
