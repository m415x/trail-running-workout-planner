import assert from 'node:assert/strict'
import test from 'node:test'
import { withValidatedRealizedTrainingMetrics } from '@/lib/numeric/realized-training-save-boundary'

test('KAN-815/A2 invalid draft never reaches the persistence callback', async () => {
  let called = 0
  for (const distance of ['12,', '12,345', '12km', '1e2']) {
    const result = await withValidatedRealizedTrainingMetrics(
      { distance, gain: '350', avgHr: '140' },
      async () => { called++; return 'saved' },
    )
    assert.deepEqual(result, { status: 'invalid' }, distance)
  }
  assert.equal(called, 0)
})

test('KAN-815/A2 empty capture fields stay unknown; numeric zero is known', async () => {
  let called = 0
  const result = await withValidatedRealizedTrainingMetrics(
    { distance: '', gain: '0', avgHr: '' },
    async metrics => { called++; return metrics },
  )
  assert.equal(result.status, 'completed')
  if (result.status !== 'completed') return
  assert.deepEqual(result.value, {
    distanceKm: { state: 'unknown' },
    elevationGainM: { state: 'known', value: 0 },
    avgHrBpm: { state: 'unknown' },
  })
  assert.equal(called, 1)
})

test('KAN-815/A2 regional comma reaches callback as canonical number once', async () => {
  const received: number[] = []
  const result = await withValidatedRealizedTrainingMetrics(
    { distance: '12,75', gain: '450', avgHr: '145' },
    async metrics => {
      if (metrics.distanceKm.state === 'known') received.push(metrics.distanceKm.value)
      return true
    },
  )
  assert.deepEqual(result, { status: 'completed', value: true })
  assert.deepEqual(received, [12.75])
})
