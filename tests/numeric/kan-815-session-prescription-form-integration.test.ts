import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const form = readFileSync('features/sessions/components/SessionForm.tsx', 'utf8')

test('KAN-815/A2 session form normalizes selected prescription metrics before submit', () => {
  assert.match(form, /normalizeSessionPrescriptionMetricDraft/)
  assert.match(form, /selectedScopes/)
  assert.match(form, /formData\.set\(/)
  assert.match(form, /formAction\(formData\)/)
})

test('KAN-815/A2 invalid numeric draft cannot reach existing server action', () => {
  assert.match(form, /normalized\.status\s*===\s*['"]invalid['"]/)
  assert.match(form, /setClientError/)
  assert.match(form, /return/)
})

test('KAN-815/A2 keeps optional blanks and real selected microcycle identifiers', () => {
  assert.match(form, /normalized\.status\s*===\s*['"]valid['"]\s*\?\s*normalized\.value\s*:\s*['"]['"]/)
  assert.match(form, /prescriptionMicrocycleId/)
  assert.match(form, /prescriptionGroupId:/)
  assert.match(form, /createSession/)
  assert.match(form, /updateSession/)
})

test('KAN-815/A2 text inputs support regional decimal and integer editing', () => {
  assert.match(form, /name=\{\x60distanceKm:\$\{microcycleId\}\x60\}\s+type='text'\s+inputMode='decimal'/)
  assert.match(form, /name=\{\x60durationMin:\$\{microcycleId\}\x60\}\s+type='text'\s+inputMode='numeric'/)
  assert.match(form, /name=\{\x60elevationGain:\$\{microcycleId\}\x60\}\s+type='text'\s+inputMode='numeric'/)
})
