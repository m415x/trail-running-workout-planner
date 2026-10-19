import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const form = readFileSync('features/workout-templates/components/WorkoutTemplateForm.tsx', 'utf8')

test('KAN-815 template form delegates to validated atomic numeric submission boundary', () => {
  assert.match(form, /import\s*\{\s*submitValidatedTemplateNumericDraft\s*\}\s*from/)
  assert.match(form, /submitValidatedTemplateNumericDraft\(formData, intensityMethod,/)
  assert.match(form, /formAction\(payload\)/)
})

test('KAN-815 rejected numeric drafts show form error without invoking server action', () => {
  assert.match(form, /result === 'invalid'/)
  assert.match(form, /setClientError\(true\)/)
  assert.doesNotMatch(form, /for \(const field of \['distanceKm', 'durationMin', 'elevationGain'\]/)
})

test('KAN-815 template retains create and edit action selection', () => {
  assert.match(form, /createWorkoutTemplate/)
  assert.match(form, /updateWorkoutTemplate/)
})
