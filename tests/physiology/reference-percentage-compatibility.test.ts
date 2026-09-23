import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyLegacyPercentage } from '@/lib/physiology/reference-percentage-compatibility'

test('historical percentages without scale provenance remain ambiguous', () => {
  assert.deepEqual(classifyLegacyPercentage({ value: 0.9, scale: 'unknown' }), {
    status: 'ambiguous',
    originalValue: 0.9,
  })
  assert.deepEqual(classifyLegacyPercentage({ value: 90, scale: 'unknown' }), {
    status: 'ambiguous',
    originalValue: 90,
  })
})

test('explicit human-scale provenance preserves 90 as 90 percent', () => {
  assert.deepEqual(classifyLegacyPercentage({ value: 90, scale: 'percent' }), {
    status: 'resolved',
    referencePercentage: 90,
  })
})

test('explicit fractional provenance converts only when declared', () => {
  assert.deepEqual(classifyLegacyPercentage({ value: 0.9, scale: 'fraction' }), {
    status: 'resolved',
    referencePercentage: 90,
  })
})
