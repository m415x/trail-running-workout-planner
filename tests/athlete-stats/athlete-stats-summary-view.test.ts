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

    assert.equal(view.training.metrics[0]?.value, 42)
    assert.equal(view.training.metrics[0]?.unit, 'km')
    assert.equal(view.training.metrics[1]?.value, null)
    assert.equal(view.training.metrics[1]?.state, 'unknown')
    assert.equal(view.load.state, 'insufficient_data')
    assert.equal(view.load.value, null)
    assert.equal(view.adherence.value, null)
    assert.equal(view.competition.state, 'none')
  })

  it('exposes locale-neutral metric identifiers and values', () => {
    const view = buildAthleteStatsSummaryView(summary)

    assert.deepEqual(view.training.metrics.map(metric => metric.key), ['distance', 'duration', 'elevation', 'sessions'])
    assert.deepEqual(view.training.metrics.map(metric => metric.value), [42, null, 1600, 4])
    assert.equal(JSON.stringify(view).match(/Distancia|Duración|Desnivel|Sesiones|sesión|sesiones/g), null)
  })

  it('exposes one drill-down target for each summary domain', () => {
    const view = buildAthleteStatsSummaryView(summary)

    assert.deepEqual(
      [view.training.href, view.load.href, view.adherence.href, view.competition.href],
      ['/stats/training', '/stats/load', '/stats/adherence', '/stats/competition'],
    )
  })
})
