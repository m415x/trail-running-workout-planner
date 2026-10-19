import assert from 'node:assert/strict'
import test from 'node:test'

import {
  validateSelfDeclaredBiometric,
  validateSelfDeclaredObservedOn,
  validateSelfDeclaredHeartRatePair,
} from '@/lib/physiology/self-declared-biometric-validation'

test('KAN-646/T5-pure accepts four canonical kinds with exact scaling at inclusive boundaries', () => {
  for (const [kind, unit, min, max, minScaled, maxScaled] of [
    ['weight', 'kg', '20.0', '350.0', 200, 3500],
    ['height', 'cm', '100.0', '250.0', 1000, 2500],
    ['max_hr', 'bpm', '60', '240', 60, 240],
    ['rest_hr', 'bpm', '25', '150', 25, 150],
  ] as const) {
    assert.deepEqual(validateSelfDeclaredBiometric({ kind, unit, value: min }), { status: 'valid', valueScaled: minScaled })
    assert.deepEqual(validateSelfDeclaredBiometric({ kind, unit, value: max }), { status: 'valid', valueScaled: maxScaled })
  }
})

test('KAN-646/T5-pure rejects overflow, excessive precision, nonfinite, malformed and wrong units', () => {
  const invalid = [
    { kind: 'weight', unit: 'kg', value: '19.9' },
    { kind: 'weight', unit: 'kg', value: '350.1' },
    { kind: 'weight', unit: 'kg', value: '72.55' },
    { kind: 'height', unit: 'cm', value: '99.9' },
    { kind: 'height', unit: 'kg', value: '170.0' },
    { kind: 'max_hr', unit: 'bpm', value: '180.5' },
    { kind: 'rest_hr', unit: 'bpm', value: '151' },
    { kind: 'weight', unit: 'kg', value: 'NaN' },
    { kind: 'weight', unit: 'kg', value: 'Infinity' },
    { kind: 'weight', unit: 'kg', value: '72kg' },
    { kind: 'weight', unit: 'kg', value: ' 72.5' },
    { kind: 'vo2max', unit: 'kg', value: '52' },
  ]
  for (const entry of invalid) assert.deepEqual(validateSelfDeclaredBiometric(entry), { status: 'invalid' })
})

test('KAN-646/T5-pure validates civil observedOn within 30 calendar days including both endpoints', () => {
  const today = '2026-10-16'
  assert.equal(validateSelfDeclaredObservedOn({ observedOn: today, today }), true)
  assert.equal(validateSelfDeclaredObservedOn({ observedOn: '2026-09-16', today }), true)
  for (const observedOn of ['2026-09-15', '2026-10-17', '2026-02-30', '2026-10-1', 'invalid']) {
    assert.equal(validateSelfDeclaredObservedOn({ observedOn, today }), false)
  }
})

test('KAN-646/T5-pure compares HR only for same SELF source, active same-cutoff measurements within 30 civil days', () => {
  const max = { valueScaled: 180, observedOn: '2026-10-16', source: 'athlete_declared' as const, isCurrentAtCutoff: true }
  const rest = { valueScaled: 60, observedOn: '2026-09-16', source: 'athlete_declared' as const, isCurrentAtCutoff: true }
  assert.equal(validateSelfDeclaredHeartRatePair({ max, rest }), 'valid_pair')
  assert.equal(validateSelfDeclaredHeartRatePair({ max, rest: { ...rest, valueScaled: 180 } }), 'invalid_pair')
  assert.equal(validateSelfDeclaredHeartRatePair({ max, rest: { ...rest, observedOn: '2026-09-15' } }), 'not_comparable')
  assert.equal(validateSelfDeclaredHeartRatePair({ max, rest: { ...rest, source: 'coach_evaluated' } }), 'not_comparable')
  assert.equal(validateSelfDeclaredHeartRatePair({ max, rest: { ...rest, isCurrentAtCutoff: false } }), 'not_comparable')
  assert.equal(validateSelfDeclaredHeartRatePair({ max, rest: null }), 'not_comparable')
})
