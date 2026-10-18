import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { formatPersistedRegionalDecimal } from '@/lib/numeric/regional-persisted-decimal-display'

test('KAN-816 renders persisted decimal without grouping, rounding or precision loss', () => {
  assert.equal(formatPersistedRegionalDecimal(12.5, 'es'), '12,5')
  assert.equal(formatPersistedRegionalDecimal(12.5, 'en'), '12.5')
  assert.equal(formatPersistedRegionalDecimal(0.25, 'es'), '0,25')
  assert.equal(formatPersistedRegionalDecimal(1000.25, 'es'), '1000,25')
  assert.equal(formatPersistedRegionalDecimal(1000.25, 'en'), '1000.25')
  assert.equal(formatPersistedRegionalDecimal(12, 'es'), '12')
  assert.equal(formatPersistedRegionalDecimal(null, 'es'), '')
  assert.equal(formatPersistedRegionalDecimal(undefined, 'en'), '')
})

test('KAN-816 applies persisted display only to decimal editable template values', () => {
  const source = readFileSync('features/workout-templates/components/WorkoutTemplateForm.tsx', 'utf8')
  assert.match(source, /formatPersistedRegionalDecimal/)
  assert.match(source, /distanceKm:.*formatPersistedRegionalDecimal/)
  assert.match(source, /referencePercentage:.*formatPersistedRegionalDecimal/)
  assert.match(source, /state\.values\?\.\[name\] \?\? originalValues\[name\]/)
})

test('KAN-816 formats the editable microcycle volume on read, not on input', () => {
  const source = readFileSync('features/planning/components/MicrocycleVolumeForm.tsx', 'utf8')
  assert.match(source, /formatPersistedRegionalDecimal\(currentVolumeKm, locale\)/)
  assert.match(source, /normalizeMicrocyclePlanningDraft\(raw, 'volumeKm'\)/)
})
