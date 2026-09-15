import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { deriveInternalLoadSignal } from '@/lib/training-load/internal-load-signal'
import type { AthleteTrainingLoadState } from '@/types'

type SourceState = Omit<AthleteTrainingLoadState, 'semanticSignal'>

function state(overrides: Partial<SourceState> = {}): SourceState {
  return {
    athleteId: 'athlete-1',
    startDate: '2026-07-01',
    endDate: '2026-08-11',
    ruleVersion: 'srpe-duration-v1',
    status: 'available',
    insufficientReasons: [],
    coverage: {
      observedDays: 42,
      knownLoadDays: 40,
      confirmedRestDays: 2,
      unknownLoadDays: 0,
      noEvidenceDays: 0,
      usableDays: 42,
      currentUsableStreakDays: 42,
      coverageRatio: 1,
    },
    days: [],
    trend: [],
    latest: {
      date: '2026-08-11',
      dailyLoadAu: 300,
      shortTermLoadAu: 450,
      longTermLoadAu: 350,
      loadBalanceAu: -100,
      status: 'available',
    },
    ...overrides,
  }
}

describe('semantic internal-load signal', () => {
  it('reports recent load above baseline from an available negative balance', () => {
    const signal = deriveInternalLoadSignal(state())

    assert.equal(signal.state, 'recent_load_above_baseline')
    assert.equal(signal.sourceRuleVersion, 'srpe-duration-v1')
    assert.equal(signal.signalRuleVersion, 'internal-load-signal-v1')
    assert.deepEqual(signal.insufficientReasons, [])
  })

  it('reports stable or lower when recent load is not above baseline', () => {
    const signal = deriveInternalLoadSignal(state({
      latest: {
        date: '2026-08-11',
        dailyLoadAu: 250,
        shortTermLoadAu: 300,
        longTermLoadAu: 350,
        loadBalanceAu: 50,
        status: 'available',
      },
    }))

    assert.equal(signal.state, 'stable_or_lower')
  })

  it('preserves insufficient evidence instead of interpreting an unavailable balance', () => {
    const signal = deriveInternalLoadSignal(state({
      status: 'warming_up',
      insufficientReasons: ['insufficient_history'],
      latest: {
        date: '2026-08-11',
        dailyLoadAu: 250,
        shortTermLoadAu: null,
        longTermLoadAu: null,
        loadBalanceAu: null,
        status: 'warming_up',
      },
    }))

    assert.equal(signal.state, 'insufficient_data')
    assert.deepEqual(signal.insufficientReasons, ['insufficient_history'])
  })
})
