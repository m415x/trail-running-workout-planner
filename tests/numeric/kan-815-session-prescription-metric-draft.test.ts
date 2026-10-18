import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeSessionPrescriptionMetricDraft } from '@/lib/numeric/session-prescription-metric-draft'

test('KAN-815/A2 session distance accepts regional single decimal without rounding', () => {
  assert.deepEqual(normalizeSessionPrescriptionMetricDraft('12,5', 'distanceKm'), { status: 'valid', value: '12.5' })
  assert.deepEqual(normalizeSessionPrescriptionMetricDraft('12.5', 'distanceKm'), { status: 'valid', value: '12.5' })
  assert.deepEqual(normalizeSessionPrescriptionMetricDraft('12,55', 'distanceKm'), { status: 'invalid' })
})

test('KAN-815/A2 optional duration and elevation preserve absence and strict integers', () => {
  for (const kind of ['durationMin', 'elevationGain'] as const) {
    assert.deepEqual(normalizeSessionPrescriptionMetricDraft('', kind), { status: 'empty' })
    assert.deepEqual(normalizeSessionPrescriptionMetricDraft('30', kind), { status: 'valid', value: '30' })
    for (const raw of ['30,5', '30.5', '1e2', '30m']) {
      assert.deepEqual(normalizeSessionPrescriptionMetricDraft(raw, kind), { status: 'invalid' }, kind + raw)
    }
  }
})

test('KAN-815/A2 session distance is optional and rejects partial or mixed formats', () => {
  assert.deepEqual(normalizeSessionPrescriptionMetricDraft('', 'distanceKm'), { status: 'empty' })
  for (const raw of ['12,', '1.234,5', '12km', '1e2']) {
    assert.deepEqual(normalizeSessionPrescriptionMetricDraft(raw, 'distanceKm'), { status: 'invalid' }, raw)
  }
})

test('KAN-815/A2 domain bounds remain in existing authorized session action', () => {
  assert.deepEqual(normalizeSessionPrescriptionMetricDraft('0', 'durationMin'), { status: 'valid', value: '0' })
  assert.deepEqual(normalizeSessionPrescriptionMetricDraft('-1', 'elevationGain'), { status: 'valid', value: '-1' })
})
