import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { shouldEvaluateAthletePeriodSession } from '@/lib/athlete-planning/period-session-candidate'

const window = { startDate: '2026-10-19', endDate: '2026-11-08' }

describe('KAN-645/T8 — temporal effective period candidates', () => {
  it('does not evaluate out-of-window, unadjusted sessions that cannot enter the period', () => {
    assert.equal(shouldEvaluateAthletePeriodSession({
      ...window,
      originalDate: '2026-10-12',
      hasAthleteAdjustment: false,
    }), false)
  })

  it('keeps original-date sessions within the requested window', () => {
    assert.equal(shouldEvaluateAthletePeriodSession({
      ...window,
      originalDate: '2026-10-19',
      hasAthleteAdjustment: false,
    }), true)
  })

  it('keeps out-of-window sessions with athlete adjustments for effective moved-in resolution', () => {
    assert.equal(shouldEvaluateAthletePeriodSession({
      ...window,
      originalDate: '2026-10-12',
      hasAthleteAdjustment: true,
    }), true)
  })

  it('keeps adjusted in-window sessions for effective moved-out resolution', () => {
    assert.equal(shouldEvaluateAthletePeriodSession({
      ...window,
      originalDate: '2026-10-26',
      hasAthleteAdjustment: true,
    }), true)
  })
})
