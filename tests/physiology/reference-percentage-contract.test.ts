import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveExecutionGuidance, type ExecutionIntensity } from '@/lib/physiology/execution-guidance'
import type { RunningReference } from '@/lib/physiology/running-reference'

/** KAN-440 RED: the explicit percentage must use the canonical contract. */
test('reference percentage uses the human scale and preserves the explicit prescription', () => {
  const intensity = {
    method: 'reference_percentage',
    referencePercentage: 90,
  } satisfies ExecutionIntensity
  const runningReference = {
    status: 'available',
    source: {
      testId: 'test-1000m',
    },
    derived: {
      paceSecPerKm: 300,
      averageSpeedKmh: 12,
    },
  } as unknown as RunningReference

  const guidance = resolveExecutionGuidance({ intensity, runningReference })

  assert.equal(guidance.prescription.method, 'reference_percentage')
  assert.deepEqual(guidance.quality, {
    status: 'available',
    intensityPercentage: 90,
    source: runningReference.status === 'available' ? runningReference.source : undefined,
    paceSecPerKm: 333,
    paceLabel: '5:33/km',
    averageSpeedKmh: 10.8,
  })
  assert.equal(guidance.zone, null)
})
