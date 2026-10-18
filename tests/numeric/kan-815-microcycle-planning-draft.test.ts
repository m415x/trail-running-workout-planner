import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeMicrocyclePlanningDraft } from '@/lib/numeric/microcycle-planning-draft'

test('KAN-815 planning volume converts comma decimal to canonical input without rounding', () => {
  assert.deepEqual(normalizeMicrocyclePlanningDraft('42,5', 'volumeKm'), { status: 'valid', value: '42.5' })
  assert.deepEqual(normalizeMicrocyclePlanningDraft('42.5', 'volumeKm'), { status: 'valid', value: '42.5' })
  assert.deepEqual(normalizeMicrocyclePlanningDraft('0', 'volumeKm'), { status: 'valid', value: '0' })
})

test('KAN-815 planning volume does not accept incomplete, excessive precision or mixed separators', () => {
  for (const raw of ['', '42,', '42,55', '1.234,5', '42km', '1e2']) {
    assert.deepEqual(normalizeMicrocyclePlanningDraft(raw, 'volumeKm'), { status: 'invalid' }, raw)
  }
})

test('KAN-815 optional elevation preserves empty as absent, integer as canonical', () => {
  assert.deepEqual(normalizeMicrocyclePlanningDraft('', 'elevationGainM'), { status: 'empty' })
  assert.deepEqual(normalizeMicrocyclePlanningDraft('1200', 'elevationGainM'), { status: 'valid', value: '1200' })
  for (const raw of ['1200,5', '1200.5', '1200m', '1e3']) {
    assert.deepEqual(normalizeMicrocyclePlanningDraft(raw, 'elevationGainM'), { status: 'invalid' }, raw)
  }
})

test('KAN-815 lexical normalizer leaves existing domain range checks untouched', () => {
  assert.deepEqual(normalizeMicrocyclePlanningDraft('1001', 'volumeKm'), { status: 'valid', value: '1001' })
  assert.deepEqual(normalizeMicrocyclePlanningDraft('-1', 'elevationGainM'), { status: 'valid', value: '-1' })
})
