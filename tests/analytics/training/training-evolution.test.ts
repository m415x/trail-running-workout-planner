import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { compareRealizedTraining } from '@/lib/analytics/training/training-evolution'
import type { RealizedTrainingSummary } from '@/lib/analytics/training/training-analytics'

function available(value: number, knownRecords = 2, observedRecords = 2) {
  return { state: 'available' as const, value, knownRecords, observedRecords }
}

function summary(values: {
  frequency?: number
  distance?: number
  duration?: number
  elevation?: number
}): RealizedTrainingSummary {
  return {
    frequency:
      values.frequency === undefined
        ? { state: 'unknown', reason: 'no_realized_evidence' }
        : { state: 'available', value: values.frequency },
    distance:
      values.distance === undefined
        ? { state: 'unknown', reason: 'metric_not_observed', knownRecords: 0, observedRecords: 2 }
        : available(values.distance),
    duration:
      values.duration === undefined
        ? { state: 'unknown', reason: 'metric_not_observed', knownRecords: 0, observedRecords: 2 }
        : available(values.duration),
    elevation:
      values.elevation === undefined
        ? { state: 'unknown', reason: 'metric_not_observed', knownRecords: 0, observedRecords: 2 }
        : available(values.elevation),
  }
}

describe('realized training evolution', () => {
  it('uses mathematical direction for comparable realized metrics', () => {
    const result = compareRealizedTraining(
      summary({ frequency: 4, distance: 42, duration: 300, elevation: 1800 }),
      summary({ frequency: 3, distance: 35, duration: 300, elevation: 2100 }),
    )

    assert.equal(result.frequency.direction, 'increasing')
    assert.equal(result.distance.direction, 'increasing')
    assert.equal(result.duration.direction, 'stable')
    assert.equal(result.elevation.direction, 'decreasing')
    assert.equal(result.distance.absoluteDelta, 7)
    assert.equal(result.distance.relativeDeltaPercent, 20)
  })

  it('preserves unknown evidence instead of inventing a trend', () => {
    const result = compareRealizedTraining(
      summary({ frequency: 2, duration: 100 }),
      summary({ frequency: 2, distance: 20, duration: 90 }),
    )

    assert.equal(result.distance.state, 'not_evaluable')
    assert.equal(result.distance.direction, 'unknown')
    assert.equal(result.distance.reason, 'current_unknown')
  })

  it('keeps relative delta null when previous evidence is explicitly zero', () => {
    const result = compareRealizedTraining(
      summary({ frequency: 1, distance: 10 }),
      summary({ frequency: 1, distance: 0 }),
    )

    assert.equal(result.distance.state, 'available')
    assert.equal(result.distance.absoluteDelta, 10)
    assert.equal(result.distance.relativeDeltaPercent, null)
    assert.equal(result.distance.direction, 'increasing')
  })
})
