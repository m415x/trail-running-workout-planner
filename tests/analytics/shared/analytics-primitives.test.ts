import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildComparableWindows,
  compareAnalyticsMetric,
} from '@/lib/analytics/shared/analytics-primitives'

describe('consumer-neutral analytics primitives', () => {
  it('builds equal contiguous current and previous windows', () => {
    assert.deepEqual(
      buildComparableWindows({ startDate: '2026-09-08', endDate: '2026-09-14' }),
      {
        current: { startDate: '2026-09-08', endDate: '2026-09-14' },
        previous: { startDate: '2026-09-01', endDate: '2026-09-07' },
      },
    )
  })

  it('reports a neutral increase from two available observations', () => {
    assert.deepEqual(
      compareAnalyticsMetric(
        { state: 'available', value: 30 },
        { state: 'available', value: 24 },
      ),
      {
        state: 'available',
        currentValue: 30,
        previousValue: 24,
        absoluteDelta: 6,
        relativeDeltaPercent: 25,
        direction: 'increasing',
      },
    )
  })

  it('does not fabricate comparison when previous evidence is unknown', () => {
    assert.deepEqual(
      compareAnalyticsMetric(
        { state: 'available', value: 30 },
        { state: 'unknown' },
      ),
      {
        state: 'not_evaluable',
        currentValue: 30,
        previousValue: null,
        absoluteDelta: null,
        relativeDeltaPercent: null,
        direction: 'unknown',
        reason: 'previous_unknown',
      },
    )
  })

  it('preserves insufficient evidence without converting it to zero', () => {
    assert.deepEqual(
      compareAnalyticsMetric(
        { state: 'insufficient_data' },
        { state: 'available', value: 12 },
      ),
      {
        state: 'not_evaluable',
        currentValue: null,
        previousValue: 12,
        absoluteDelta: null,
        relativeDeltaPercent: null,
        direction: 'unknown',
        reason: 'current_insufficient_data',
      },
    )
  })

  it('preserves an explicit zero and leaves relative delta undefined from a zero baseline', () => {
    assert.deepEqual(
      compareAnalyticsMetric(
        { state: 'available', value: 5 },
        { state: 'available', value: 0 },
      ),
      {
        state: 'available',
        currentValue: 5,
        previousValue: 0,
        absoluteDelta: 5,
        relativeDeltaPercent: null,
        direction: 'increasing',
      },
    )
  })

  it('uses mathematical stability for equal values', () => {
    const result = compareAnalyticsMetric(
      { state: 'available', value: 0 },
      { state: 'available', value: 0 },
    )

    assert.equal(result.direction, 'stable')
    assert.equal(result.currentValue, 0)
    assert.equal(result.previousValue, 0)
  })
})
