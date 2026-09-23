import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateMicrocycleIntensityTarget } from '@/lib/periodization/microcycle-intensity-target'
import { suggestIntensityStrategy } from '@/lib/periodization/intensity-strategy-recommender'

test('microcycle planning exposes the canonical reference percentage without a legacy field', () => {
  const target = calculateMicrocycleIntensityTarget({
    period: 'competitive',
    microcycleType: 'shock',
    intensityStrategy: suggestIntensityStrategy('S3', 'performance'),
    planningIntent: 'development',
  })

  assert.equal(target.referencePercentageTarget, 100)
  assert.equal(Object.hasOwn(target, 'referencePercentageTarget'), false)
})
