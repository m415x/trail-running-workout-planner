import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { generateFractalMacrocycle } from '@/lib/periodization/macrocycle-generator'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'
import { reconcilePlanningRegeneration } from '@/lib/periodization/planning-regeneration'

function createGeneratedPlanning() {
  const loadStrategy = suggestLoadStrategy('S2', 'base')
  const generatedPlanning = generateFractalMacrocycle({
    title: 'Plan regenerado',
    goalType: 'base',
    startDate: '2026-01-05',
    endDate: '2026-03-01',
    athleteGroup: 'S2',
    loadStrategy,
  })

  return { generatedPlanning, loadStrategy }
}

describe('regeneración de planificación', () => {
  it('preserva volúmenes manuales y reemplaza los generados', () => {
    const { generatedPlanning, loadStrategy } = createGeneratedPlanning()
    const result = reconcilePlanningRegeneration({
      generatedPlanning,
      loadStrategy,
      existingMicrocycles: [
        { id: 'week-1', weekNumber: 1, targetVolumeKm: 33, targetVolumeSource: 'generated' },
        { id: 'week-2', weekNumber: 2, targetVolumeKm: 34.5, targetVolumeSource: 'manual' },
      ],
    })
    const weeks = result.planning.mesocycles.flatMap((mesocycle) => mesocycle.microcycles)

    assert.equal(weeks[0].targetVolumeKm, 35)
    assert.equal(weeks[0].targetVolumeSource, 'generated')
    assert.equal(weeks[1].targetVolumeKm, 34.5)
    assert.equal(weeks[1].targetVolumeSource, 'manual')
    assert.deepEqual(result.preservedManualWeekNumbers, [2])
    assert.deepEqual(result.conflicts, [])
  })

  it('detecta un volumen manual incompatible sin sobrescribirlo', () => {
    const { generatedPlanning, loadStrategy } = createGeneratedPlanning()
    const result = reconcilePlanningRegeneration({
      generatedPlanning,
      loadStrategy,
      existingMicrocycles: [
        { id: 'week-2', weekNumber: 2, targetVolumeKm: 45, targetVolumeSource: 'manual' },
      ],
    })
    const week = result.planning.mesocycles.flatMap((mesocycle) => mesocycle.microcycles)[1]

    assert.equal(week.targetVolumeKm, 45)
    assert.equal(week.targetVolumeSource, 'manual')
    assert.equal(result.conflicts[0].code, 'manual_volume_above_maximum')
  })

  it('permite restaurar una semana manual al valor generado', () => {
    const { generatedPlanning, loadStrategy } = createGeneratedPlanning()
    const generatedWeek = generatedPlanning.mesocycles[0].microcycles[1]
    const result = reconcilePlanningRegeneration({
      generatedPlanning,
      loadStrategy,
      existingMicrocycles: [
        { id: 'week-2', weekNumber: 2, targetVolumeKm: 34.5, targetVolumeSource: 'manual' },
      ],
      restoreGeneratedWeekNumbers: [2],
    })
    const restoredWeek = result.planning.mesocycles[0].microcycles[1]

    assert.equal(restoredWeek.targetVolumeKm, generatedWeek.targetVolumeKm)
    assert.equal(restoredWeek.targetVolumeSource, 'generated')
    assert.deepEqual(result.restoredGeneratedWeekNumbers, [2])
    assert.deepEqual(result.preservedManualWeekNumbers, [])
  })

  it('informa semanas manuales que quedan fuera del nuevo horizonte', () => {
    const { generatedPlanning, loadStrategy } = createGeneratedPlanning()
    const result = reconcilePlanningRegeneration({
      generatedPlanning,
      loadStrategy,
      existingMicrocycles: [
        { id: 'week-20', weekNumber: 20, targetVolumeKm: 38, targetVolumeSource: 'manual' },
      ],
    })

    assert.equal(result.conflicts[0].code, 'manual_week_outside_horizon')
  })

  it('detecta semanas duplicadas en la planificación existente', () => {
    const { generatedPlanning, loadStrategy } = createGeneratedPlanning()
    const result = reconcilePlanningRegeneration({
      generatedPlanning,
      loadStrategy,
      existingMicrocycles: [
        { id: 'week-2-a', weekNumber: 2, targetVolumeKm: 34, targetVolumeSource: 'manual' },
        { id: 'week-2-b', weekNumber: 2, targetVolumeKm: 35, targetVolumeSource: 'manual' },
      ],
    })

    assert.equal(result.conflicts.some((conflict) => conflict.code === 'duplicate_week_number'), true)
  })
})
