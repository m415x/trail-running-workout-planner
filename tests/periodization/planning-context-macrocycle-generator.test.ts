import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  PlanningContextGenerationError,
  generateMacrocycleFromPlanningContext,
} from '@/lib/periodization/planning-context-macrocycle-generator'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'

const s2RaceStrategy = suggestLoadStrategy('S2', 'race')
const s2PerformanceStrategy = suggestLoadStrategy('S2', 'performance')
const s2BaseStrategy = suggestLoadStrategy('S2', 'base')

describe('generación con intención y contexto competitivo separados', () => {
  it('no activa tapering por usar un goalType legacy de carrera', () => {
    const result = generateMacrocycleFromPlanningContext({
      title: 'Desarrollo S2',
      planningIntent: 'development',
      startDate: '2026-01-05',
      endDate: '2026-03-01',
      athleteGroup: 'S2',
      loadStrategy: s2RaceStrategy,
    })

    assert.equal(result.planningIntent, 'development')
    assert.equal(result.goalType, 'race')
    assert.equal(result.race, null)
    assert.equal(result.taperingWeeksCount, 0)
    assert.equal(result.mesocycles.some((mesocycle) => mesocycle.period === 'competitive'), false)
  })

  it('activa el comportamiento competitivo desde CompetitionContext aunque el goalType legacy no sea race', () => {
    const result = generateMacrocycleFromPlanningContext({
      title: 'Desarrollo S2 · carrera objetivo',
      planningIntent: 'development',
      startDate: '2026-01-05',
      endDate: '2026-03-29',
      athleteGroup: 'S2',
      loadStrategy: s2PerformanceStrategy,
      competitionContext: {
        primaryCompetition: {
          id: 'competition-primary',
          name: 'Maratón de prueba',
          date: '2026-03-29',
          distanceKm: 42,
          elevationGain: 1200,
          priority: 'A',
        },
        intermediateCompetitions: [],
      },
    })

    assert.equal(result.goalType, 'performance')
    assert.equal(result.planningIntent, 'development')
    assert.equal(result.race?.name, 'Maratón de prueba')
    assert.equal(result.race?.date, '2026-03-29')
    assert.equal(result.taperingWeeksCount, 3)
    assert.equal(result.mesocycles.at(-1)?.period, 'competitive')
    assert.equal(result.mesocycles.at(-1)?.microcycles.at(-1)?.type, 'race')
  })

  it('rechaza una estrategia legacy cuya semántica no coincide con PlanningIntent', () => {
    assert.throws(
      () => generateMacrocycleFromPlanningContext({
        title: 'Base S2',
        planningIntent: 'development',
        startDate: '2026-01-05',
        endDate: '2026-03-01',
        athleteGroup: 'S2',
        loadStrategy: s2BaseStrategy,
      }),
      (error) => error instanceof PlanningContextGenerationError
        && error.code === 'LOAD_STRATEGY_INTENT_MISMATCH',
    )
  })
})
