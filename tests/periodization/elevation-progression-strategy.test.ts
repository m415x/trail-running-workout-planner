import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolveElevationProgressionStrategy } from '@/lib/periodization/elevation-progression-strategy'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'

describe('estrategia de progresión de desnivel', () => {
  it('resuelve los objetivos sugeridos con unidades y límites explícitos', () => {
    const strategy = resolveElevationProgressionStrategy(
      suggestLoadStrategy('S2', 'race'),
    )

    assert.deepEqual(strategy, {
      mode: 'progressive',
      initial: { elevationGainM: 720, source: 'suggested' },
      maximum: { elevationGainM: 840, source: 'suggested' },
      maximumWeeklyIncreasePercentage: 10,
      deloadPercentage: 25,
    })
  })

  it('mantiene objetivos manuales independientes de los kilómetros', () => {
    const loadStrategy = suggestLoadStrategy('S2', 'base')
    loadStrategy.values.initialWeeklyElevationGain = 1_000
    loadStrategy.values.maximumWeeklyElevationGain = 1_800
    loadStrategy.fieldSources.initialWeeklyElevationGain = 'manual'
    loadStrategy.fieldSources.maximumWeeklyElevationGain = 'manual'

    const strategy = resolveElevationProgressionStrategy(loadStrategy)

    assert.equal(strategy.mode, 'progressive')
    if (strategy.mode === 'progressive') {
      assert.deepEqual(strategy.initial, { elevationGainM: 1_000, source: 'manual' })
      assert.deepEqual(strategy.maximum, { elevationGainM: 1_800, source: 'manual' })
    }
  })

  it('respeta la ausencia explícita de un objetivo de desnivel', () => {
    const loadStrategy = suggestLoadStrategy('S2', 'maintenance')
    loadStrategy.values.initialWeeklyElevationGain = null
    loadStrategy.values.maximumWeeklyElevationGain = null

    assert.deepEqual(resolveElevationProgressionStrategy(loadStrategy), {
      mode: 'disabled',
      reason: 'not_configured',
    })
  })

  it('rechaza límites incompletos, decimales o invertidos', () => {
    const incomplete = suggestLoadStrategy('S2', 'base')
    incomplete.values.maximumWeeklyElevationGain = null
    assert.throws(
      () => resolveElevationProgressionStrategy(incomplete),
      /deben estar configurados juntos/,
    )

    const decimal = suggestLoadStrategy('S2', 'base')
    decimal.values.initialWeeklyElevationGain = 700.5
    assert.throws(
      () => resolveElevationProgressionStrategy(decimal),
      /metros enteros no negativos/,
    )

    const inverted = suggestLoadStrategy('S2', 'base')
    inverted.values.initialWeeklyElevationGain = 900
    inverted.values.maximumWeeklyElevationGain = 800
    assert.throws(
      () => resolveElevationProgressionStrategy(inverted),
      /no puede superar/,
    )
  })
})
