import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAthleteStatsAdherenceSource } from '@/lib/athlete-stats/athlete-stats-adherence-source'
import type { AthletePlanRealComparison } from '@/types/training/plan-real-comparison.types'

const scope = {
  athleteId: 'athlete-1',
  teamId: 'team-1',
  startDate: '2026-09-08',
  endDate: '2026-09-14',
}

const comparison = {
  teamId: 'team-1',
  athleteId: 'athlete-1',
  window: { kind: 'week', startDate: scope.startDate, endDate: scope.endDate },
  items: [],
  planningLimitations: [],
} satisfies AthletePlanRealComparison

describe('athlete stats adherence source', () => {
  it('reuses KAN-259 plan-real comparison and KAN-260 adherence derivation', async () => {
    const calls: unknown[][] = []
    const source = createAthleteStatsAdherenceSource({
      getAthletePlanRealComparison: async (...args) => {
        calls.push(args)
        return { success: true, data: comparison }
      },
    })

    const adherence = await source.getAdherence(scope)

    assert.deepEqual(calls, [[
      'athlete-1',
      { kind: 'week', startDate: '2026-09-08', endDate: '2026-09-14' },
    ]])
    assert.equal(adherence.athleteId, 'athlete-1')
    assert.equal(adherence.frequency.state, 'insufficient_data')
    assert.equal(adherence.frequency.adherencePercent, null)
  })

  it('rejects a comparison whose authoritative team does not match the resolved subject', async () => {
    const source = createAthleteStatsAdherenceSource({
      getAthletePlanRealComparison: async () => ({
        success: true,
        data: { ...comparison, teamId: 'other-team' },
      }),
    })

    await assert.rejects(() => source.getAdherence(scope), /scope mismatch/)
  })
})
