import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolveElevationProgressionStrategy } from '@/lib/periodization/elevation-progression-strategy'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'
import { calculateMesocycleElevationTargets } from '@/lib/periodization/mesocycle-elevation-targets'

describe('objetivos de desnivel por mesociclo', () => {
  it('distribuye el crecimiento hasta alcanzar el máximo en el último bloque', () => {
    const loadStrategy = suggestLoadStrategy('S2', 'base')
    loadStrategy.values.initialWeeklyElevationGain = 900
    loadStrategy.values.maximumWeeklyElevationGain = 1_800

    const targets = calculateMesocycleElevationTargets({
      strategy: resolveElevationProgressionStrategy(loadStrategy),
      mesocycleCount: 3,
    })

    assert.deepEqual(targets, [
      { mesocycleNumber: 1, targetPeakElevationGain: 1_200 },
      { mesocycleNumber: 2, targetPeakElevationGain: 1_500 },
      { mesocycleNumber: 3, targetPeakElevationGain: 1_800 },
    ])
  })

  it('mantiene un objetivo estable cuando el inicio ya es el máximo', () => {
    const loadStrategy = suggestLoadStrategy('S2', 'base')
    loadStrategy.values.initialWeeklyElevationGain = 1_200
    loadStrategy.values.maximumWeeklyElevationGain = 1_200

    const targets = calculateMesocycleElevationTargets({
      strategy: resolveElevationProgressionStrategy(loadStrategy),
      mesocycleCount: 3,
    })

    assert.deepEqual(
      targets.map((target) => target.targetPeakElevationGain),
      [1_200, 1_200, 1_200],
    )
  })

  it('mantiene el horizonte pero no inventa D+ cuando está desactivado', () => {
    const loadStrategy = suggestLoadStrategy('S2', 'base')
    loadStrategy.values.initialWeeklyElevationGain = null
    loadStrategy.values.maximumWeeklyElevationGain = null

    const targets = calculateMesocycleElevationTargets({
      strategy: resolveElevationProgressionStrategy(loadStrategy),
      mesocycleCount: 2,
    })

    assert.deepEqual(targets, [
      { mesocycleNumber: 1, targetPeakElevationGain: null },
      { mesocycleNumber: 2, targetPeakElevationGain: null },
    ])
  })

  it('rechaza cantidades de mesociclos inválidas', () => {
    const strategy = resolveElevationProgressionStrategy(
      suggestLoadStrategy('S2', 'base'),
    )

    assert.throws(
      () => calculateMesocycleElevationTargets({ strategy, mesocycleCount: 0 }),
      /entero mayor que cero/,
    )
  })
})
