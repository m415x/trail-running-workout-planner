import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  determineTaperingWeeksCount,
  generateFractalMacrocycle,
} from '@/lib/periodization/macrocycle-generator'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'

const s2BaseStrategy = suggestLoadStrategy('S2', 'base')
const s2RaceStrategy = suggestLoadStrategy('S2', 'race')

describe('generación de planificación', () => {
  it('genera un objetivo sin carrera sin tapering ni bloque competitivo', () => {
    const result = generateFractalMacrocycle({
      title: '  Base S2  ',
      goalType: 'base',
      startDate: '2026-01-05',
      endDate: '2026-03-01',
      athleteGroup: 'S2',
      loadStrategy: s2BaseStrategy,
    })

    const weeks = result.mesocycles.flatMap((mesocycle) => mesocycle.microcycles)
    assert.equal(result.title, 'Base S2')
    assert.equal(result.taperingWeeksCount, 0)
    assert.equal(result.race, null)
    assert.equal(result.mesocycles.some((mesocycle) => mesocycle.period === 'competitive'), false)
    assert.deepEqual(
      result.mesocycles.map((mesocycle) => mesocycle.targetPeakVolumeKm),
      [37, 39],
    )
    assert.deepEqual(
      weeks.map((week) => week.targetVolumeKm),
      [35, 36, 37, 27.8, 37, 38, 39, 29.3],
    )
    assert.equal(weeks.length, 8)
    assert.deepEqual(weeks.map((week) => week.weekNumber), [1, 2, 3, 4, 5, 6, 7, 8])
    assertConsecutiveWeeks(weeks)
  })

  it('genera tapering de tres semanas y termina con la carrera objetivo', () => {
    const result = generateFractalMacrocycle({
      title: 'Maratón',
      goalType: 'race',
      startDate: '2026-01-05',
      endDate: '2026-03-29',
      athleteGroup: 'S2',
      loadStrategy: s2RaceStrategy,
      race: { name: 'Maratón de prueba', distanceKm: 42, elevationGain: 1200 },
    })

    const weeks = result.mesocycles.flatMap((mesocycle) => mesocycle.microcycles)
    const competitive = result.mesocycles.at(-1)
    assert.equal(determineTaperingWeeksCount('S2', result.race ?? undefined), 3)
    assert.equal(result.taperingWeeksCount, 3)
    assert.equal(competitive?.period, 'competitive')
    assert.deepEqual(competitive?.microcycles.map((week) => week.type), ['tapering', 'tapering', 'race'])
    assert.equal(competitive?.microcycles.at(-1)?.targetElevationGain, 1200)
    assert.match(competitive?.microcycles.at(-1)?.notes ?? '', /Maratón de prueba/)
    assert.equal(weeks.length, 12)
    assertConsecutiveWeeks(weeks)
  })

  it('usa dos semanas competitivas para una carrera corta', () => {
    assert.equal(determineTaperingWeeksCount('S2', { name: '10K', distanceKm: 10 }), 2)
  })

  it('rechaza una carrera sin sus datos obligatorios', () => {
    assert.throws(() => generateFractalMacrocycle({
      title: 'Objetivo inválido',
      goalType: 'race',
      startDate: '2026-01-05',
      endDate: '2026-03-01',
      athleteGroup: 'S2',
      loadStrategy: s2RaceStrategy,
    }), /requiere los datos de la carrera/)
  })

  it('usa los valores efectivos de la estrategia en lugar de la matriz del grupo', () => {
    const loadStrategy = suggestLoadStrategy('S2', 'base')
    loadStrategy.values.initialWeeklyVolumeKm = 20
    loadStrategy.values.maximumWeeklyVolumeKm = 30

    const result = generateFractalMacrocycle({
      title: 'Base manual S2',
      goalType: 'base',
      startDate: '2026-01-05',
      endDate: '2026-03-01',
      athleteGroup: 'S2',
      loadStrategy,
    })

    const volumes = result.mesocycles[0].microcycles.map((week) => week.targetVolumeKm)
    assert.deepEqual(volumes, [20, 22.5, 25, 18.8])
  })

  it('rechaza una estrategia que no corresponde al grupo o al objetivo', () => {
    assert.throws(() => generateFractalMacrocycle({
      title: 'Estrategia incorrecta',
      goalType: 'base',
      startDate: '2026-01-05',
      endDate: '2026-03-01',
      athleteGroup: 'S2',
      loadStrategy: suggestLoadStrategy('S1', 'base'),
    }), /pertenece a otro grupo/)

    assert.throws(() => generateFractalMacrocycle({
      title: 'Estrategia incorrecta',
      goalType: 'base',
      startDate: '2026-01-05',
      endDate: '2026-03-01',
      athleteGroup: 'S2',
      loadStrategy: suggestLoadStrategy('S2', 'race'),
    }), /pertenece a otro tipo de objetivo/)
  })
})

function assertConsecutiveWeeks(weeks: Array<{ startDate: string; endDate: string }>) {
  for (let index = 1; index < weeks.length; index += 1) {
    const previousEnd = new Date(`${weeks[index - 1].endDate}T00:00:00Z`)
    previousEnd.setUTCDate(previousEnd.getUTCDate() + 1)
    assert.equal(weeks[index].startDate, previousEnd.toISOString().slice(0, 10))
  }
}
