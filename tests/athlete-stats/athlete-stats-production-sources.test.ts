import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAthleteStatsTrainingSources } from '@/lib/athlete-stats/athlete-stats-production-sources'
import type { RealizedTrainingRecord } from '@/types/training/readiness.types'

const scope = {
  athleteId: 'athlete-1',
  teamId: 'team-1',
  startDate: '2026-09-08',
  endDate: '2026-09-14',
}

describe('athlete stats production training sources', () => {
  it('loads realized evidence with the complete server-resolved subject and period', async () => {
    const calls: unknown[][] = []
    const sources = createAthleteStatsTrainingSources({
      listRealizedTrainingRecordsForAthleteInDateRange: (...args) => {
        calls.push(args)
        return []
      },
    })

    const records = await sources.listRealizedTraining(scope)

    assert.deepEqual(records, [])
    assert.deepEqual(calls, [[
      'athlete-1',
      'team-1',
      '2026-09-08',
      '2026-09-14',
    ]])
  })

  it('derives KAN-344 load from the same durable realized evidence boundary', async () => {
    const records = [{ id: 'realized-1' }] as unknown as RealizedTrainingRecord[]
    let calls = 0
    const sources = createAthleteStatsTrainingSources({
      listRealizedTrainingRecordsForAthleteInDateRange: () => {
        calls += 1
        return records
      },
    })

    const load = await sources.getTrainingLoad(scope)

    assert.equal(calls, 1)
    assert.equal(load.athleteId, 'athlete-1')
    assert.equal(load.startDate, '2026-09-08')
    assert.equal(load.endDate, '2026-09-14')
  })
})
