import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAthleteStatsProductionSources } from '@/lib/athlete-stats/athlete-stats-production-wiring'

const scope = {
  athleteId: 'athlete-1',
  teamId: 'team-1',
  startDate: '2026-09-08',
  endDate: '2026-09-14',
}

describe('athlete stats production wiring', () => {
  it('assembles every source port behind one dependency object', async () => {
    const calls: string[] = []
    const sources = createAthleteStatsProductionSources({
      training: {
        listRealizedTraining: async () => { calls.push('training'); return [] },
        getTrainingLoad: async () => { calls.push('load'); return {} as never },
      },
      adherence: {
        getAdherence: async () => { calls.push('adherence'); return {} as never },
      },
      competition: {
        getCompetitionContext: async () => { calls.push('competition'); return {} as never },
      },
    })

    await sources.listRealizedTraining(scope)
    await sources.getTrainingLoad(scope)
    await sources.getAdherence(scope)
    await sources.getCompetitionContext(scope)

    assert.deepEqual(calls, ['training', 'load', 'adherence', 'competition'])
  })
})
