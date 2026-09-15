import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { projectLoadAnalytics } from '@/lib/analytics/load/load-analytics'
import type { AthleteTrainingLoadState, TrainingLoadTrendPoint } from '@/types/training/training-load.types'

function state(
  status: AthleteTrainingLoadState['status'],
  latest: AthleteTrainingLoadState['latest'],
  trend: readonly TrainingLoadTrendPoint[] = latest ? [latest] : [],
): AthleteTrainingLoadState {
  return {
    athleteId: 'athlete-1',
    startDate: '2026-08-01',
    endDate: '2026-09-15',
    ruleVersion: 'srpe-duration-v1',
    status,
    insufficientReasons: status === 'available' ? [] : ['insufficient_history'],
    coverage: {
      observedDays: 46,
      knownLoadDays: 30,
      confirmedRestDays: 10,
      unknownLoadDays: 2,
      noEvidenceDays: 4,
      usableDays: 40,
      currentUsableStreakDays: 20,
      coverageRatio: 40 / 46,
    },
    days: [],
    trend,
    latest,
    semanticSignal: {
      state: status === 'available' ? 'stable_or_lower' : 'insufficient_data',
      startDate: '2026-08-01',
      endDate: '2026-09-15',
      sourceRuleVersion: 'srpe-duration-v1',
      signalRuleVersion: 'internal-load-signal-v1',
      insufficientReasons: status === 'available' ? [] : ['insufficient_history'],
    },
  }
}

describe('load analytics', () => {
  it('projects existing neutral load evidence without deriving a new formula', () => {
    const result = projectLoadAnalytics(state('available', {
      date: '2026-09-15',
      dailyLoadAu: 320,
      shortTermLoadAu: 280,
      longTermLoadAu: 250,
      loadBalanceAu: 30,
      status: 'available',
    }))

    assert.equal(result.state, 'available')
    assert.equal(result.latest.shortTermLoadAu, 280)
    assert.equal(result.latest.longTermLoadAu, 250)
    assert.equal(result.latest.loadBalanceAu, 30)
    assert.equal(result.ruleVersion, 'srpe-duration-v1')
  })

  it('preserves the existing genuine load trend for descriptive detail views', () => {
    const first: TrainingLoadTrendPoint = {
      date: '2026-09-14',
      dailyLoadAu: 240,
      shortTermLoadAu: 260,
      longTermLoadAu: 245,
      loadBalanceAu: -15,
      status: 'available',
    }
    const latest: TrainingLoadTrendPoint = {
      date: '2026-09-15',
      dailyLoadAu: 320,
      shortTermLoadAu: 280,
      longTermLoadAu: 250,
      loadBalanceAu: -30,
      status: 'available',
    }

    const result = projectLoadAnalytics(state('available', latest, [first, latest]))

    assert.deepEqual(result.trend, [first, latest])
  })

  it('preserves insufficient evidence as non-evaluable', () => {
    const result = projectLoadAnalytics(state('warming_up', null))

    assert.equal(result.state, 'insufficient_data')
    assert.deepEqual(result.reasons, ['insufficient_history'])
    assert.equal(result.latest, null)
    assert.deepEqual(result.trend, [])
  })
})
