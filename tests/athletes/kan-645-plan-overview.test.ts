import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildAthletePlanOverview } from '@/lib/athlete-planning/plan-overview'

const weeks = [
  { monday: '2026-10-05', distance: { status: 'complete' as const, value: 32 }, elevationGain: { status: 'complete' as const, value: 950 } },
  { monday: '2026-10-12', distance: { status: 'incomplete' as const, value: null }, elevationGain: { status: 'complete' as const, value: 1200 } },
  { monday: '2026-10-19', distance: { status: 'unknown' as const, value: null }, elevationGain: { status: 'unknown' as const, value: null } },
]

describe('KAN-645/T5 — accessible multiweek planning overview', () => {
  it('uses an unequivocal effective period when it covers the selected week', () => {
    const result = buildAthletePlanOverview({
      selectedMonday: '2026-10-12',
      effectivePeriods: [{ id: 'plan-1', startDate: '2026-10-01', endDate: '2026-10-31' }],
      weeks,
    })
    assert.equal(result.status, 'loaded')
    if (result.status !== 'loaded') return
    assert.deepEqual(result.period, { source: 'planning', startDate: '2026-10-01', endDate: '2026-10-31' })
    assert.equal(result.weeks.length, 3)
  })

  it('falls back to a readable temporal window for ambiguous or missing period hierarchy', () => {
    const result = buildAthletePlanOverview({
      selectedMonday: '2026-10-12',
      effectivePeriods: [
        { id: 'plan-1', startDate: '2026-10-01', endDate: '2026-10-31' },
        { id: 'plan-2', startDate: '2026-10-05', endDate: '2026-11-05' },
      ],
      weeks,
    })
    assert.equal(result.status, 'loaded')
    if (result.status !== 'loaded') return
    assert.deepEqual(result.period, { source: 'window', startDate: '2026-10-05', endDate: '2026-10-25' })
  })

  it('preserves evidence coverage for accessible text instead of inventing complete volume', () => {
    const result = buildAthletePlanOverview({ selectedMonday: '2026-10-12', effectivePeriods: [], weeks })
    assert.equal(result.status, 'loaded')
    if (result.status !== 'loaded') return
    assert.deepEqual(result.weeks[1], weeks[1])
    assert.equal(result.weeks[1].distance.status, 'incomplete')
    assert.equal(result.weeks[1].distance.value, null)
    assert.equal(result.weeks[2].elevationGain.status, 'unknown')
  })

  it('refuses inconsistent weekly identities instead of showing misleading charts', () => {
    assert.deepEqual(buildAthletePlanOverview({
      selectedMonday: '2026-10-12',
      effectivePeriods: [],
      weeks: [weeks[0], { ...weeks[0], distance: { status: 'complete', value: 99 } }],
    }), { status: 'error' })
  })
})
