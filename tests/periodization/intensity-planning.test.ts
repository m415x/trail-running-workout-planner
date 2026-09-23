import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateIntensityFeasibility } from '@/lib/periodization/intensity-feasibility-validator'
import {
  getIntensityStrategyRuleForPlanningIntent,
  INTENSITY_STRATEGY_MATRIX,
  REFERENCE_PERCENTAGE_STEPS,
} from '@/lib/periodization/intensity-strategy-matrix'
import {
  suggestIntensityStrategyLimits,
  suggestIntensityStrategyLimitsForPlanningIntent,
} from '@/lib/periodization/intensity-strategy-limits'
import {
  getNearestReferencePercentageStep,
  proposeMicrocycleIntensity,
} from '@/lib/periodization/microcycle-intensity-proposal'
import { calculateMicrocycleIntensityTarget } from '@/lib/periodization/microcycle-intensity-target'
import {
  suggestIntensityStrategy,
  suggestIntensityStrategyForPlanningIntent,
} from '@/lib/periodization/intensity-strategy-recommender'
import { applyManualMicrocycleIntensityChanges } from '@/lib/periodization/intensity-target-modifications'
import { reconcileMicrocycleIntensityTarget } from '@/lib/periodization/intensity-target-regeneration'
import type { MicrocycleIntensityTargetDraft } from '@/types'

describe('planificación de intensidad', () => {
  it('define una matriz exhaustiva por intención con porcentajes PAM prácticos', () => {
    const rules = Object.values(INTENSITY_STRATEGY_MATRIX).flatMap((microcycles) => (
      Object.values(microcycles).flatMap((intents) => Object.values(intents))
    ))

    assert.equal(rules.length, 4 * 6 * 3)
    assert.equal(rules.every((rule) => (
      rule.suggestedReferencePercentage === null
      || (REFERENCE_PERCENTAGE_STEPS as readonly number[]).includes(rule.suggestedReferencePercentage)
    )), true)
  })

  it('race y performance legacy resuelven la misma política development', () => {
    const race = suggestIntensityStrategy('S2', 'race')
    const performance = suggestIntensityStrategy('S2', 'performance')
    const development = suggestIntensityStrategyForPlanningIntent('S2', 'development', 'performance')

    assert.deepEqual(race.values, performance.values)
    assert.deepEqual(performance.values, development.values)
    assert.deepEqual(
      suggestIntensityStrategyLimits('S2', 'race'),
      suggestIntensityStrategyLimits('S2', 'performance'),
    )
    assert.deepEqual(
      suggestIntensityStrategyLimits('S2', 'performance'),
      suggestIntensityStrategyLimitsForPlanningIntent('S2', 'development'),
    )
    assert.deepEqual(
      getIntensityStrategyRuleForPlanningIntent('competitive', 'shock', 'development'),
      {
        emphasis: 'vo2max',
        predominantZone: 'Z5',
        intenseSessionDemand: 'high',
        suggestedReferencePercentage: 100,
      },
    )
  })

  it('limita más la intensidad en principiantes y objetivos de base', () => {
    assert.deepEqual(suggestIntensityStrategyLimits('S1', 'race'), {
      maximumIntenseSessionsPerWeek: 2,
      minimumRecoveryDaysBetweenIntenseSessions: 1,
    })
    assert.deepEqual(suggestIntensityStrategyLimits('S3', 'race'), {
      maximumIntenseSessionsPerWeek: 1,
      minimumRecoveryDaysBetweenIntenseSessions: 2,
    })
    assert.equal(
      suggestIntensityStrategyLimits('S1', 'base').maximumIntenseSessionsPerWeek,
      1,
    )
  })

  it('selecciona PAM para desarrollo y zonas para mantenimiento', () => {
    assert.equal(suggestIntensityStrategy('S2', 'performance').values.defaultMethod, 'reference_percentage')
    assert.equal(suggestIntensityStrategy('S2', 'maintenance').values.defaultMethod, 'hr_zone')
  })

  it('calcula el objetivo semanal sin superar el límite de la estrategia', () => {
    const strategy = suggestIntensityStrategy('S3', 'performance')
    const target = calculateMicrocycleIntensityTarget({
      period: 'competitive',
      microcycleType: 'shock',
      intensityStrategy: strategy,
      planningIntent: 'development',
    })

    assert.equal(target.intenseSessionsTarget, 1)
    assert.equal(target.predominantZone, 'Z5')
    assert.equal(target.referencePercentageTarget, 100)
  })

  it('protege descarga, taper y semana de carrera sin depender de goalType race', () => {
    const strategy = suggestIntensityStrategyForPlanningIntent('S1', 'development', 'performance')
    const calculate = (microcycleType: 'deload' | 'tapering' | 'race') => (
      calculateMicrocycleIntensityTarget({
        period: 'competitive',
        microcycleType,
        intensityStrategy: strategy,
        planningIntent: 'development',
      })
    )

    assert.equal(calculate('deload').intenseSessionsTarget, 0)
    assert.equal(calculate('tapering').intenseSessionsTarget, 1)
    assert.equal(calculate('tapering').referencePercentageTarget, 90)
    assert.equal(calculate('race').intenseSessionsTarget, 0)
    assert.equal(calculate('race').referencePercentageTarget, null)
  })

  it('redondea PAM hacia el escalón práctico más cercano sin subir empates', () => {
    assert.equal(getNearestReferencePercentageStep(87.6), 90)
    assert.equal(getNearestReferencePercentageStep(85), 80)
    assert.equal(getNearestReferencePercentageStep(118), 120)
  })

  it('usa zona cuando una semana no contiene un estímulo PAM ejecutable', () => {
    const target = targetFixture({ intenseSessionsTarget: 0, referencePercentageTarget: null })

    assert.deepEqual(proposeMicrocycleIntensity({
      target,
      defaultMethod: 'reference_percentage',
    }), { method: 'hr_zone', zone: 'Z2' })
  })

  it('detecta objetivos que no caben por sesiones o recuperación', () => {
    const result = validateIntensityFeasibility({
      target: targetFixture({
        intenseSessionsTarget: 3,
        minimumRecoveryDaysBetweenIntenseSessions: 3,
      }),
      sessionsPerWeek: 2,
    })

    assert.equal(result.isValid, false)
    assert.equal(result.maximumFeasibleIntenseSessions, 2)
    assert.equal(result.errors.length, 2)
  })

  it('registra procedencia manual por campo y permite volver a generado', () => {
    const generated = targetFixture()
    const manual = applyManualMicrocycleIntensityChanges(generated, {
      referencePercentageTarget: 95,
    })
    const restored = applyManualMicrocycleIntensityChanges(generated, {
      referencePercentageTarget: 90,
    })

    assert.equal(manual.fieldSources.referencePercentageTarget, 'manual')
    assert.equal(manual.fieldSources.predominantZone, 'generated')
    assert.equal(restored.fieldSources.referencePercentageTarget, 'generated')
  })

  it('preserva solo campos manuales durante una regeneración', () => {
    const existing = applyManualMicrocycleIntensityChanges(targetFixture(), {
      referencePercentageTarget: null,
      minimumRecoveryDaysBetweenIntenseSessions: 2,
    })
    const nextGenerated = targetFixture({
      predominantZone: 'Z4',
      referencePercentageTarget: 100,
    })
    const result = reconcileMicrocycleIntensityTarget({
      generatedTarget: nextGenerated,
      existingTarget: existing,
    })

    assert.equal(result.target.predominantZone, 'Z4')
    assert.equal(result.target.referencePercentageTarget, null)
    assert.equal(result.target.minimumRecoveryDaysBetweenIntenseSessions, 2)
    assert.deepEqual(result.preservedManualFields, [
      'referencePercentageTarget',
      'minimumRecoveryDaysBetweenIntenseSessions',
    ])
  })
})

function targetFixture(
  overrides: Partial<MicrocycleIntensityTargetDraft> = {},
): MicrocycleIntensityTargetDraft {
  return {
    emphasis: 'threshold',
    intenseSessionsTarget: 2,
    predominantZone: 'Z2',
    referencePercentageTarget: 90,
    minimumRecoveryDaysBetweenIntenseSessions: 1,
    fieldSources: {
      intenseSessionsTarget: 'generated',
      predominantZone: 'generated',
      referencePercentageTarget: 'generated',
      minimumRecoveryDaysBetweenIntenseSessions: 'generated',
    },
    ...overrides,
  }
}