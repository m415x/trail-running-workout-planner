import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const form = readFileSync('features/planning/components/SessionGenerationPreferencesForm.tsx', 'utf8')

test('KAN-815/A2 frequency form normalizes lexical draft before existing action', () => {
  assert.match(form, /import\s*\{\s*normalizeFixedSessionFrequencyDraft\s*\}\s*from\s*['"]@\/lib\/numeric\/session-frequency-draft['"]/)
  assert.match(form, /normalizeFixedSessionFrequencyDraft\(fixedSessions\)/)
  assert.match(form, /normalized\.status\s*===\s*['"]invalid['"]/)
  assert.match(form, /formData\.set\(['"]fixedSessionsPerWeek['"]/)
  assert.match(form, /formAction\(formData\)/)
})

test('KAN-815/A2 preserves automatic-mode empty and rejects incomplete drafts', () => {
  assert.match(form, /normalized\.status\s*===\s*['"]valid['"]\s*\?\s*normalized\.value\s*:\s*['"]['"]/)
  assert.match(form, /setClientError\(/)
  assert.match(form, /type='text'/)
  assert.match(form, /inputMode='numeric'/)
})

test('KAN-815/A2 preserves plan context, pattern and server authorization boundary', () => {
  assert.match(form, /name='planId'/)
  assert.match(form, /name='locale'/)
  assert.match(form, /name='weeklyPattern'/)
  assert.match(form, /updateSessionGenerationPreferences/)
  assert.match(form, /hasValidDayCount/)
})
