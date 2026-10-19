import assert from 'node:assert/strict'
import test from 'node:test'
import { parseRealizedTrainingMetricDraft } from '@/lib/numeric/realized-training-metric-draft'

test('KAN-815/A2 accepts regional decimal distance without rounding', () => {
  assert.deepEqual(parseRealizedTrainingMetricDraft('12,75', 'distanceKm'), { status: 'valid', metric: { state: 'known', value: 12.75 } })
  assert.deepEqual(parseRealizedTrainingMetricDraft('12.75', 'distanceKm'), { status: 'valid', metric: { state: 'known', value: 12.75 } })
})

test('KAN-815/A2 empty realized metric remains unknown, not known zero', () => {
  assert.deepEqual(parseRealizedTrainingMetricDraft('', 'distanceKm'), { status: 'valid', metric: { state: 'unknown' } })
  assert.deepEqual(parseRealizedTrainingMetricDraft('0', 'distanceKm'), { status: 'valid', metric: { state: 'known', value: 0 } })
  assert.deepEqual(parseRealizedTrainingMetricDraft('', 'avgHrBpm'), { status: 'valid', metric: { state: 'unknown' } })
})

test('KAN-815/A2 rejects partial and malformed capture before saving', () => {
  for (const draft of ['12,', '12.345', '12,3.4', '12km', '1e2', '-']) {
    assert.deepEqual(parseRealizedTrainingMetricDraft(draft, 'distanceKm'), { status: 'invalid' }, draft)
  }
})

test('KAN-815/A2 elevation and heart rate remain strict integers', () => {
  assert.deepEqual(parseRealizedTrainingMetricDraft('450', 'elevationGainM'), { status: 'valid', metric: { state: 'known', value: 450 } })
  assert.deepEqual(parseRealizedTrainingMetricDraft('145', 'avgHrBpm'), { status: 'valid', metric: { state: 'known', value: 145 } })
  assert.deepEqual(parseRealizedTrainingMetricDraft('145,5', 'avgHrBpm'), { status: 'invalid' })
  assert.deepEqual(parseRealizedTrainingMetricDraft('450.5', 'elevationGainM'), { status: 'invalid' })
})
