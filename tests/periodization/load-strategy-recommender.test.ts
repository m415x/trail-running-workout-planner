import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { GROUP_VOLUME_MATRIX } from '@/data/periodization-matrix'
import {
  suggestLoadStrategy,
  suggestLoadStrategyForPlanningIntent,
} from '@/lib/periodization/load-strategy-recommender'

import type { AthleteGroupCode, TrainingGoalType } from '@/types'

const GOAL_TYPES: TrainingGoalType[] = ['race', 'performance', 'base', 'maintenance', 'custom']

describe('recomendaciones de estrategia de carga', () => {
  it('propone el perfil de desarrollo para un objetivo legacy de carrera', () => {
    const strategy = suggestLoadStrategy('S2', 'race')

    assert.deepEqual(strategy.context, { athleteGroup: 'S2', goalType: 'race' })
    assert.deepEqual(strategy.values, {
      initialWeeklyVolumeKm: 36,
      maximumWeeklyVolumeKm: 42,
      maximumWeeklyIncreasePercentage: 10,
      deloadPercentage: 25,
      initialWeeklyElevationGain: 720,
      maximumWeeklyElevationGain: 840,
    })
  })

  it('race y performance legacy comparten exactamente la política de development', () => {
    const race = suggestLoadStrategy('S2', 'race')
    const performance = suggestLoadStrategy('S2', 'performance')
    const development = suggestLoadStrategyForPlanningIntent('S2', 'development', 'performance')

    assert.deepEqual(race.values, performance.values)
    assert.deepEqual(race.fieldSources, performance.fieldSources)
    assert.deepEqual(performance.values, development.values)
    assert.deepEqual(performance.fieldSources, development.fieldSources)
    assert.equal(race.context.goalType, 'race')
    assert.equal(performance.context.goalType, 'performance')
  })

  it('mantiene una propuesta conservadora para mantenimiento', () => {
    const strategy = suggestLoadStrategy('S2', 'maintenance')

    assert.equal(strategy.values.initialWeeklyVolumeKm, 35)
    assert.equal(strategy.values.maximumWeeklyVolumeKm, 36)
    assert.equal(strategy.values.maximumWeeklyIncreasePercentage, 5)
    assert.equal(strategy.values.deloadPercentage, 15)
  })

  it('marca todos los valores iniciales como sugeridos', () => {
    const strategy = suggestLoadStrategy('U1', 'performance')

    assert.equal(
      Object.values(strategy.fieldSources).every((source) => source === 'suggested'),
      true,
    )
  })

  it('produce recomendaciones coherentes para todos los grupos y objetivos', () => {
    const groups = Object.keys(GROUP_VOLUME_MATRIX) as AthleteGroupCode[]

    for (const group of groups) {
      for (const goalType of GOAL_TYPES) {
        const { values } = suggestLoadStrategy(group, goalType)

        assert.ok(values.initialWeeklyVolumeKm <= values.maximumWeeklyVolumeKm)
        assert.ok(values.maximumWeeklyIncreasePercentage > 0)
        assert.ok(values.deloadPercentage >= 15 && values.deloadPercentage <= 25)
        assert.ok((values.initialWeeklyElevationGain ?? 0) >= 0)
        assert.ok(
          (values.maximumWeeklyElevationGain ?? 0)
            >= (values.initialWeeklyElevationGain ?? 0),
        )
      }
    }
  })
})
