import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { athleteStatsSummaryPeriod } from '@/lib/athlete-stats/athlete-stats-summary-period'

describe('athlete stats summary period', () => {
  it('returns an inclusive rolling 28-day window ending on the supplied day', () => {
    assert.deepEqual(athleteStatsSummaryPeriod(new Date('2026-09-15T17:30:00-03:00')), {
      startDate: '2026-08-19',
      endDate: '2026-09-15',
    })
  })
})
