import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateIntensityFeasibility } from '@/lib/periodization/intensity-feasibility-validator'
import {
  INTENSITY_STRATEGY_MATRIX,
  PAM_PERCENTAGE_STEPS,
} from '@/lib/periodization/intensity-strategy-matrix'
import { suggestIntensityStrategyLimits } from '@/lib/periodization/intensity-strategy-limits'
import {
  getNearestPamPercentageStep,
  proposeMicrocycleIntensity,
} from '@/lib/periodization/microcycle-intensity-proposal'
import { calculateMicrocycleIntensityTarget } from '@/lib/periodization/microcycle-intensity-target'
import { suggestIntensityStrategy } from '@/lib/periodization/intensity-strategy-recommender'
import { applyManualMicrocycleIntensityChanges } from '@/lib/periodization/intensity-target-modifications'
import { reconcileMicrocycleIntensityTarget } from '@/lib/periodization/intensity-target-regeneration'
import type { MicrocycleIntensityTargetDraft } from '@/types'

describe('planificación de intensidad', () => {
  it('define una matriz exhaustiva con porcentajes PAM prácticos', () => {
    const rules = Object.values(INTENSITY_STRATEGY_MATRIX).flatMap((microcycles) => (
      Object.values(microcycles).flatMap((goals) => Object.values(goals))
    ))

    assert.equal(rules.length, 4 * 6 * 5)
    assert.equal(rules.every((rule) => (
      rule.suggestedPamPercentage === null
      || (PAM_PERCENTAGE_STEPS as readonly number[]).includes(rule.suggestedPamPercentage)
    )), true)
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

  it('selecciona PAM para rendimiento y zonas para mantenimiento', () => {
    assert.equal(suggestIntensityStrategy('S2', 'performance').values.defaultMethod, 'pam_percentage')
    assert.equal(suggestIntensityStrategy('S2', 'maintenance').values.defaultMethod, 'hr_zone')
  })

  it('calcula el objetivo semanal sin superar el límite de la estrategia', () => {
    const strategy = suggestIntensityStrategy('S3', 'performance')
    const target = calculateMicrocycleIntensityTarget({
      period: 'competitive',
      microcycleType: 'shock',
      intensityStrategy: strategy,
    })

    assert.equal(target.intenseSessionsTarget, 1)
    assert.equal(target.predominantZone, 'Z5')
    assert.equal(target.pamPercentageTarget, 100)
  })

  it('protege descarga, taper y semana de carrera', () => {
    const strategy = suggestIntensityStrategy('S1', 'race')
    const calculate = (microcycleType: 'deload' | 'tapering' | 'race') => (
      calculateMicrocycleIntensityTarget({
        period: 'competitive',
        microcycleType,
        intensityStrategy: strategy,
      })
    )

    assert.equal(calculate('deload').intenseSessionsTarget, 0)
    assert.equal(calculate('tapering').intenseSessionsTarget, 1)
    assert.equal(calculate('tapering').pamPercentageTarget, 90)
    assert.equal(calculate('race').intenseSessionsTarget, 0)
    assert.equal(calculate('race').pamPercentageTarget, null)
  })

  it('redondea PAM hacia el escalón práctico más cercano sin subir empates', () => {
    assert.equal(getNearestPamPercentageStep(87.6), 90)
    assert.equal(getNearestPamPercentageStep(85), 80)
    assert.equal(getNearestPamPercentageStep(118), 120)
  })

  it('usa zona cuando una semana no contiene un estímulo PAM ejecutable', () => {
    const target = targetFixture({ intenseSessionsTarget: 0, pamPercentageTarget: null })

    assert.deepEqual(proposeMicrocycleIntensity({
      target,
      defaultMethod: 'pam_percentage',
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
      pamPercentageTarget: 95,
    })
    const restored = applyManualMicrocycleIntensityChanges(generated, {
      pamPercentageTarget: 90,
    })

    assert.equal(manual.fieldSources.pamPercentageTarget, 'manual')
    assert.equal(manual.fieldSources.predominantZone, 'generated')
    assert.equal(restored.fieldSources.pamPercentageTarget, 'generated')
  })

  it('preserva solo campos manuales durante una regeneración', () => {
    const existing = applyManualMicrocycleIntensityChanges(targetFixture(), {
      pamPercentageTarget: null,
      minimumRecoveryDaysBetweenIntenseSessions: 2,
    })
    const nextGenerated = targetFixture({
      predominantZone: 'Z4',
      pamPercentageTarget: 100,
    })
    const result = reconcileMicrocycleIntensityTarget({
      generatedTarget: nextGenerated,
      existingTarget: existing,
    })

    assert.equal(result.target.predominantZone, 'Z4')
    assert.equal(result.target.pamPercentageTarget, null)
    assert.equal(result.target.minimumRecoveryDaysBetweenIntenseSessions, 2)
    assert.deepEqual(result.preservedManualFields, [
      'pamPercentageTarget',
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
    pamPercentageTarget: 90,
    minimumRecoveryDaysBetweenIntenseSessions: 1,
    fieldSources: {
      intenseSessionsTarget: 'generated',
      predominantZone: 'generated',
      pamPercentageTarget: 'generated',
      minimumRecoveryDaysBetweenIntenseSessions: 'generated',
    },
    ...overrides,
  }
}
