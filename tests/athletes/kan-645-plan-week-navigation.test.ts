import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  resolveSelectedAthletePlanWeek,
  shiftAthletePlanWeek,
  athletePlanWeekHref,
} from '@/lib/athlete-planning/plan-week-navigation'

describe('KAN-645/T2 — civil-Monday week navigation', () => {
  it('uses the current local civil Monday when ?week is absent', () => {
    assert.deepEqual(resolveSelectedAthletePlanWeek(null, '2026-10-14'), {
      status: 'resolved',
      monday: '2026-10-12',
    })
  })

  it('accepts only an actual YYYY-MM-DD Monday and rejects invalid or non-Monday values', () => {
    assert.deepEqual(resolveSelectedAthletePlanWeek('2026-10-05', '2026-10-14'), {
      status: 'resolved',
      monday: '2026-10-05',
    })
    for (const invalid of ['2026-10-06', '2026-02-30', 'not-a-date', '2026-10-05T00:00:00Z']) {
      assert.deepEqual(resolveSelectedAthletePlanWeek(invalid, '2026-10-14'), {
        status: 'invalid',
      })
    }
  })

  it('moves exactly seven civil days across month/year boundaries and permits unrestricted prior/future weeks', () => {
    assert.equal(shiftAthletePlanWeek('2026-12-28', 1), '2027-01-04')
    assert.equal(shiftAthletePlanWeek('2027-01-04', -1), '2026-12-28')
    assert.equal(shiftAthletePlanWeek('2035-05-07', 1), '2035-05-14')
  })

  it('preserves locale and unrelated query parameters when navigating and returning to today', () => {
    assert.equal(
      athletePlanWeekHref('/en/plan?view=overview&week=2026-10-05', '2026-10-12'),
      '/en/plan?view=overview&week=2026-10-12',
    )
    assert.equal(
      athletePlanWeekHref('/es/plan?week=2026-10-19', '2026-10-12'),
      '/es/plan?week=2026-10-12',
    )
  })
})
