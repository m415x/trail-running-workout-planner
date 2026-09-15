import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { projectCompetitionAnalytics } from '@/lib/analytics/competition/competition-analytics'
import type { CompetitionContext } from '@/types/training/competition-context.types'

const context: CompetitionContext = {
  primaryCompetition: {
    id: 'race-a',
    name: 'A Race',
    date: '2026-11-01',
    distanceKm: 50,
    elevationGain: 2500,
    priority: 'A',
  },
  intermediateCompetitions: [
    {
      id: 'race-b',
      name: 'B Race',
      date: '2026-10-01',
      distanceKm: 21,
      priority: 'B',
    },
  ],
}

describe('competition analytics', () => {
  it('projects only factual competition context', () => {
    const result = projectCompetitionAnalytics(context)

    assert.deepEqual(result.primaryCompetition, context.primaryCompetition)
    assert.deepEqual(result.intermediateCompetitions, context.intermediateCompetitions)
    assert.equal('readiness' in result, false)
    assert.equal('recommendation' in result, false)
    assert.equal('prediction' in result, false)
  })
})
