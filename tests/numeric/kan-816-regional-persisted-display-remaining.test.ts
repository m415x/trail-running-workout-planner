import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-816 biometric SELF formats persisted decimal weight and height on initialization', () => {
  const source = readFileSync('features/profile/components/BiometricSelfEditor.tsx', 'utf8')
  assert.match(source, /formatPersistedRegionalDecimal\(current\.valueScaled \/ parameter\.scale,.*\)/)
})

test('KAN-816 SessionForm formats decimal persisted prescription and reference percentage, preserving draft changes', () => {
  const source = readFileSync('features/sessions/components/SessionForm.tsx', 'utf8')
  assert.match(source, /formatPersistedRegionalDecimal\(defaults\.distance, locale\)/)
  assert.match(source, /formatPersistedRegionalDecimal\(defaults\.referencePercentage, locale\)/)
  assert.match(source, /\[field\]: value/)
})

test('KAN-816 LoadStrategy formats decimal suggestions on initialization and when suggestion changes', () => {
  const source = readFileSync('features/planning/components/LoadStrategyForm.tsx', 'utf8')
  assert.match(source, /function draftsFromStrategy\(strategy: LoadStrategyDraft, locale: string\)/)
  assert.match(source, /formatPersistedRegionalDecimal\(strategy\.values\.initialWeeklyVolumeKm, locale\)/)
  assert.match(source, /draftsFromStrategy\(suggestion, locale\)/)
  assert.match(source, /draftsFromStrategy\(next, locale\)/)
})
