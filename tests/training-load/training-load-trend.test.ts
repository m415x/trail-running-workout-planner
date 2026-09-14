import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { deriveTrainingLoadTrend } from '@/lib/training-load/training-load-trend'
import type { DailyTrainingLoad } from '@/types'

function day(date: string, loadAu: number | null): DailyTrainingLoad {
  return {
    date,
    state: loadAu === null ? 'no_evidence' : loadAu === 0 ? 'confirmed_rest' : 'known_load',
    loadAu,
    durationMin: loadAu === null ? null : loadAu === 0 ? 0 : 60,
    rpe: loadAu === null || loadAu === 0 ? null : loadAu / 60,
    external: {
      distanceM: null,
      elevationGainM: null,
      elevationLossM: null,
    },
    missingRequiredMetrics: [],
    sourceRecordIds: [],
  }
}

function dates(startDate: string, count: number): string[] {
  const result: string[] = []
  const cursor = new Date(`${startDate}T00:00:00Z`)
  for (let index = 0; index < count; index += 1) {
    result.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return result
}

describe('training load trend', () => {
  it('seeds short and long term load from the first reliable day', () => {
    const result = deriveTrainingLoadTrend([day('2026-09-14', 300)])

    assert.deepEqual(result[0], {
      date: '2026-09-14',
      dailyLoadAu: 300,
      shortTermLoadAu: 300,
      longTermLoadAu: 300,
      loadBalanceAu: 0,
      status: 'warming_up',
    })
  })

  it('updates short and long term estimates without cumulative rounding', () => {
    const result = deriveTrainingLoadTrend([
      day('2026-09-13', 300),
      day('2026-09-14', 0),
    ])

    const shortAlpha = 1 - Math.exp(-1 / 7)
    const longAlpha = 1 - Math.exp(-1 / 42)
    const expectedShort = 300 + (0 - 300) * shortAlpha
    const expectedLong = 300 + (0 - 300) * longAlpha

    assert.equal(result[1]?.shortTermLoadAu, expectedShort)
    assert.equal(result[1]?.longTermLoadAu, expectedLong)
    assert.equal(result[1]?.loadBalanceAu, expectedLong - expectedShort)
  })

  it('breaks continuity instead of treating missing evidence as zero load', () => {
    const result = deriveTrainingLoadTrend([
      day('2026-09-12', 300),
      day('2026-09-13', null),
      day('2026-09-14', 240),
    ])

    assert.deepEqual(result[1], {
      date: '2026-09-13',
      dailyLoadAu: null,
      shortTermLoadAu: null,
      longTermLoadAu: null,
      loadBalanceAu: null,
      status: 'insufficient_data',
    })
    assert.equal(result[2]?.shortTermLoadAu, 240)
    assert.equal(result[2]?.longTermLoadAu, 240)
    assert.equal(result[2]?.status, 'warming_up')
  })

  it('becomes available only after 42 consecutive reliable days', () => {
    const reliableDays = dates('2026-08-04', 42).map((date, index) => day(date, index % 7 === 0 ? 300 : 0))
    const result = deriveTrainingLoadTrend(reliableDays)

    assert.equal(result[40]?.status, 'warming_up')
    assert.equal(result[41]?.status, 'available')
  })
})
