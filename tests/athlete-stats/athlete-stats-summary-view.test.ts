import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildAthleteStatsSummaryView } from '@/lib/athlete-stats/athlete-stats-summary-view'
import type { AthleteStatsSummary } from '@/lib/athlete-stats/athlete-stats-projections'

const summary = {
  period: { startDate: '2026-08-19', endDate: '2026-09-15' },
  training: {
    distance: { state: 'available', value: 42, unit: 'km', evidence: { knownRecords: 4, observedRecords: 4 }, comparison: { state: 'not_evaluable', currentValue: 42, previousValue: null, absoluteDelta: null, relativeDeltaPercent: null, direction: 'unknown', reason: 'previous_unknown' } },
    duration: { state: 'unknown', value: null, unit: 'min', evidence: { knownRecords: 4, observedRecords: 0 }, comparison: { state: 'not_evaluable', currentValue: null, previousValue: null, absoluteDelta: null, relativeDeltaPercent: null, direction: 'unknown', reason: 'current_unknown' } },
    elevation: { state: 'available', value: 1600, unit: 'm', evidence: { knownRecords: 4, observedRecords: 4 }, comparison: { state: 'not_evaluable', currentValue: 1600, previousValue: null, absoluteDelta: null, relativeDeltaPercent: null, direction: 'unknown', reason: 'previous_unknown' } },
    frequency: { state: 'available', value: 4, unit: 'sessions', comparison: { state: 'not_evaluable', currentValue: 4, previousValue: null, absoluteDelta: null, relativeDeltaPercent: null, direction: 'unknown', reason: 'previous_unknown' } },
  },
  load: { state: 'insufficient_data', shortTermLoadAu: null, longTermLoadAu: null, loadBalanceAu: null, coverageRatio: 0.25 },
  adherence: { state: 'insufficient_data', value: null, coveragePercent: null },
  competition: null,
} satisfies AthleteStatsSummary

describe('athlete stats summary view', () => {
  it('preserves unknown and insufficient states instead of rendering zeros', () => {
    const view = buildAthleteStatsSummaryView(summary)

    assert.equal(view.training.metrics[0]?.displayValue, '42 km')
    assert.equal(view.training.metrics[1]?.displayValue, null)
    assert.equal(view.training.metrics[1]?.state, 'unknown')
    assert.equal(view.load.state, 'insufficient_data')
    assert.equal(view.load.displayValue, null)
    assert.equal(view.adherence.displayValue, null)
    assert.equal(view.competition.state, 'none')
  })

  it('renders the frequency unit in athlete-facing Spanish', () => {
    const view = buildAthleteStatsSummaryView(summary)
    assert.equal(view.training.metrics[3]?.displayValue, '4 sesiones')
  })

  it('exposes one drill-down target for each summary domain', () => {
    const view = buildAthleteStatsSummaryView(summary)

    assert.deepEqual(
      [view.training.href, view.load.href, view.adherence.href, view.competition.href],
      ['/stats/training', '/stats/load', '/stats/adherence', '/stats/competition'],
    )
  })
})
