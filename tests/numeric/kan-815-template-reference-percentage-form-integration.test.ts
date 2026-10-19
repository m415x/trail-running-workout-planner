import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const form = readFileSync('features/workout-templates/components/WorkoutTemplateForm.tsx', 'utf8')
const boundary = readFileSync('lib/numeric/template-numeric-submit-boundary.ts', 'utf8')

test('KAN-815/A2 delegates conditional reference percentage normalization to tested boundary', () => {
  assert.match(form, /submitValidatedTemplateNumericDraft\(formData, intensityMethod,/)
  assert.match(boundary, /normalizeTemplateReferencePercentageDraft/)
  assert.match(boundary, /intensityMethod === 'reference_percentage'/)
  assert.match(boundary, /input\.get\('referencePercentage'\)/)
  assert.match(boundary, /normalizedMetrics\.push\(\['referencePercentage', parsed\.value\]\)/)
})

test('KAN-815/A2 rejects malformed active percentage before existing action', () => {
  assert.match(boundary, /if \(parsed\.status !== 'valid'\) return 'invalid'/)
  assert.match(form, /if \(result === 'invalid'\)/)
  assert.match(form, /setClientError\(true\)/)
  assert.match(form, /formAction\(payload\)/)
})

test('KAN-815/A2 keeps regional input usable and does not require inactive percentage', () => {
  assert.match(form, /name='referencePercentage'[^\n]*type='text' inputMode='decimal'/)
  assert.match(form, /createWorkoutTemplate/)
  assert.match(form, /updateWorkoutTemplate/)
})
