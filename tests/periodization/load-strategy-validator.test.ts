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

  it('acepta exactamente 10% de incremento semanal sin advertencias', () => {
    const strategy = strategyForS2()
    strategy.values.maximumWeeklyIncreasePercentage = 10

    const result = validateLoadStrategy(strategy)

    assert.equal(result.isValid, true)
    assert.equal(
      result.warnings.some((currentIssue) => currentIssue.code === 'weekly-increase-above-reference'),
      false,
    )
  })

  it('acepta exactamente 20% de incremento semanal con advertencia', () => {
    const strategy = strategyForS2()
    strategy.values.maximumWeeklyIncreasePercentage = 20

    const result = validateLoadStrategy(strategy)

    assert.equal(result.isValid, true)
    assert.ok(result.warnings.some((currentIssue) => currentIssue.code === 'weekly-increase-above-reference'))
    assert.equal(
      result.errors.some((currentIssue) => currentIssue.code === 'weekly-increase-range'),
      false,
    )
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

  it('rechaza valores numéricos no finitos', () => {
    const invalidVolume = strategyForS2()
    invalidVolume.values.initialWeeklyVolumeKm = Number.NaN

    const invalidMaximum = strategyForS2()
    invalidMaximum.values.maximumWeeklyVolumeKm = Number.POSITIVE_INFINITY

    const invalidElevation = strategyForS2()
    invalidElevation.values.maximumWeeklyElevationGain = Number.NaN

    assert.equal(validateLoadStrategy(invalidVolume).isValid, false)
    assert.equal(validateLoadStrategy(invalidMaximum).isValid, false)
    assert.equal(validateLoadStrategy(invalidElevation).isValid, false)
  })

  it('exige informar ambos límites de desnivel o ninguno', () => {
    const missingMaximum = strategyForS2()
    missingMaximum.values.maximumWeeklyElevationGain = null

    const omittedRange = strategyForS2()
    omittedRange.values.initialWeeklyElevationGain = null
    omittedRange.values.maximumWeeklyElevationGain = null

    const missingMaximumResult = validateLoadStrategy(missingMaximum)

    assert.equal(missingMaximumResult.isValid, false)
    assert.ok(missingMaximumResult.errors.some(
      (currentIssue) => currentIssue.code === 'incomplete-elevation-range',
    ))
    assert.equal(validateLoadStrategy(omittedRange).isValid, true)
  })

  it('advierte densidades verticales altas y extremas sin bloquearlas', () => {
    const highDensity = strategyForS2()
    highDensity.values.initialWeeklyVolumeKm = 20
    highDensity.values.initialWeeklyElevationGain = 2_000
    highDensity.values.maximumWeeklyVolumeKm = 30
    highDensity.values.maximumWeeklyElevationGain = 6_000

    const result = validateLoadStrategy(highDensity)

    assert.equal(result.isValid, true)
    assert.equal(
      result.warnings.some((warning) => warning.code === 'initial-elevation-density-high'),
      true,
    )
    assert.equal(
      result.warnings.some((warning) => warning.code === 'maximum-elevation-density-extreme'),
      true,
    )
  })
})
