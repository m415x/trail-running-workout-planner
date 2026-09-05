import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { generateFractalMacrocycle } from '@/lib/periodization/macrocycle-generator'
import { assertPersistablePlanning } from '@/lib/periodization/planning-persistence-validator'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'

function validPlanning() {
  return generateFractalMacrocycle({
    title: 'Plan S2',
    goalType: 'base',
    startDate: '2026-01-05',
    endDate: '2026-03-01',
    athleteGroup: 'S2',
    loadStrategy: suggestLoadStrategy('S2', 'base'),
  })
}

describe('validación previa de persistencia', () => {
  it('acepta una planificación generada íntegra', () => {
    assert.doesNotThrow(() => assertPersistablePlanning(validPlanning()))
  })

  it('rechaza semanas duplicadas antes de persistir', () => {
    const planning = validPlanning()
    planning.mesocycles[1].microcycles[0].weekNumber = 1

    assert.throws(() => assertPersistablePlanning(planning), /semana 1 está duplicada/)
  })

  it('rechaza D+ y procedencias inválidas en tiempo de ejecución', () => {
    const invalidElevation = validPlanning()
    invalidElevation.mesocycles[0].microcycles[0].targetElevationGain = -10
    assert.throws(() => assertPersistablePlanning(invalidElevation), /D\+ de la semana 1/)

    const invalidSource = validPlanning()
    Object.assign(invalidSource.mesocycles[0].microcycles[0], {
      targetElevationSource: 'unknown',
    })
    assert.throws(() => assertPersistablePlanning(invalidSource), /origen del D\+/)
  })
})
