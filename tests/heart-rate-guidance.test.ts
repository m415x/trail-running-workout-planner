import assert from 'node:assert/strict'
import test from 'node:test'

import { calculateKarvonenBpm, getZoneBpmRange } from '@/lib/physiology/heart-rate'

test('requires explicit resting HR for Karvonen instead of inventing 50 bpm', () => {
  assert.throws(
    () => calculateKarvonenBpm(0.65, 190, undefined),
    /resting heart rate/i,
  )
})

test('requires explicit max HR for zone BPM guidance', () => {
  assert.throws(
    () => getZoneBpmRange('Z2', { maxHr: undefined, restHr: undefined }),
    /maximum heart rate/i,
  )
})

test('uses percentage of max HR when resting HR is explicitly unavailable', () => {
  assert.deepEqual(
    getZoneBpmRange('Z2', { maxHr: 180, restHr: undefined }),
    { minBpm: 108, maxBpm: 126 },
  )
})
