import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'
import { validateLoadStrategy } from '@/lib/periodization/load-strategy-validator'

function strategyForS2() {
  return suggestLoadStrategy('S2', 'race')
}

describe('validación de estrategia de carga', () => {
  it('acepta la estrategia sugerida por el sistema', () => {
    const result = validateLoadStrategy(strategyForS2())

    assert.equal(result.isValid, true)
    assert.deepEqual(result.errors, [])
    assert.deepEqual(result.warnings, [])
  })

  it('rechaza un volumen inicial superior al máximo', () => {
    const strategy = strategyForS2()
    strategy.values.initialWeeklyVolumeKm = 45
    strategy.values.maximumWeeklyVolumeKm = 40

    const result = validateLoadStrategy(strategy)

    assert.equal(result.isValid, false)
    assert.ok(result.errors.some((currentIssue) => currentIssue.code === 'initial-volume-above-maximum'))
  })

  it('advierte cuando el volumen sale del rango del grupo sin bloquear la estrategia', () => {
    const strategy = strategyForS2()
    strategy.values.maximumWeeklyVolumeKm = 45

    const result = validateLoadStrategy(strategy)

    assert.equal(result.isValid, true)
    assert.ok(result.warnings.some((currentIssue) => currentIssue.code === 'maximum-volume-outside-group-range'))
  })

  it('rechaza un incremento semanal superior al límite duro', () => {
    const strategy = strategyForS2()
    strategy.values.maximumWeeklyIncreasePercentage = 21

    const result = validateLoadStrategy(strategy)

    assert.equal(result.isValid, false)
    assert.ok(result.errors.some((currentIssue) => currentIssue.code === 'weekly-increase-range'))
  })

  it('advierte sobre incrementos mayores al 10% que todavía están dentro del límite duro', () => {
    const strategy = strategyForS2()
    strategy.values.maximumWeeklyIncreasePercentage = 12

    const result = validateLoadStrategy(strategy)

    assert.equal(result.isValid, true)
    assert.ok(result.warnings.some((currentIssue) => currentIssue.code === 'weekly-increase-above-reference'))
  })

  it('rechaza sesiones no enteras o fuera del rango semanal', () => {
    const decimalStrategy = strategyForS2()
    decimalStrategy.values.sessionsPerWeek = 4.5

    const excessiveStrategy = strategyForS2()
    excessiveStrategy.values.sessionsPerWeek = 8

    assert.equal(validateLoadStrategy(decimalStrategy).isValid, false)
    assert.equal(validateLoadStrategy(excessiveStrategy).isValid, false)
  })

  it('rechaza porcentajes de descarga fuera de rango', () => {
    const strategy = strategyForS2()
    strategy.values.deloadPercentage = 100

    const result = validateLoadStrategy(strategy)

    assert.equal(result.isValid, false)
    assert.ok(result.errors.some((currentIssue) => currentIssue.code === 'deload-range'))
  })

  it('rechaza desnivel negativo o inicial superior al máximo', () => {
    const negativeStrategy = strategyForS2()
    negativeStrategy.values.initialWeeklyElevationGain = -1

    const invertedStrategy = strategyForS2()
    invertedStrategy.values.initialWeeklyElevationGain = 900
    invertedStrategy.values.maximumWeeklyElevationGain = 800

    assert.equal(validateLoadStrategy(negativeStrategy).isValid, false)
    assert.equal(validateLoadStrategy(invertedStrategy).isValid, false)
  })
})
