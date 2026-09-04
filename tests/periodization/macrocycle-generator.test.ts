import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  determineTaperingWeeksCount,
  determineProgressionDurationProfile,
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
    assert.equal(result.trainingWeeksCount, 8)
    assert.equal(result.progressionDurationProfile, 'normal')
    assert.equal(result.race, null)
    assert.deepEqual(result.generationWarnings, [])
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
    assert.equal(result.trainingWeeksCount, 9)
    assert.equal(result.progressionDurationProfile, 'normal')
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
    assert.deepEqual(volumes, [20, 21.6, 23.3, 17.5])
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

  it('limita incrementos bruscos y advierte cuando no alcanza el máximo', () => {
    const loadStrategy = suggestLoadStrategy('S2', 'custom')
    loadStrategy.values.initialWeeklyVolumeKm = 20
    loadStrategy.values.maximumWeeklyVolumeKm = 80
    loadStrategy.values.maximumWeeklyIncreasePercentage = 5

    const result = generateFractalMacrocycle({
      title: 'Progresión limitada',
      goalType: 'custom',
      startDate: '2026-01-05',
      endDate: '2026-03-01',
      athleteGroup: 'S2',
      loadStrategy,
    })
    const trainingWeeks = result.mesocycles.flatMap((mesocycle) => mesocycle.microcycles)
    const loadingVolumes = trainingWeeks
      .filter((week) => week.type !== 'deload')
      .map((week) => week.targetVolumeKm)

    assert.deepEqual(loadingVolumes, [20, 21, 22.1, 22.1, 23.2, 24.4])
    assert.equal(result.mesocycles.at(-1)?.targetPeakVolumeKm, 24.4)
    assert.match(result.generationWarnings[0], /por debajo del máximo configurado de 80 km/)
  })

  it('clasifica la progresión según las semanas de entrenamiento disponibles', () => {
    assert.equal(determineProgressionDurationProfile(4), 'short')
    assert.equal(determineProgressionDurationProfile(7), 'short')
    assert.equal(determineProgressionDurationProfile(8), 'normal')
    assert.equal(determineProgressionDurationProfile(16), 'normal')
    assert.equal(determineProgressionDurationProfile(17), 'long')
    assert.throws(() => determineProgressionDurationProfile(1), /al menos 2 semanas/)
  })

  it('adapta la cantidad de bloques a horizontes cortos, normales y extensos', () => {
    const loadStrategy = suggestLoadStrategy('S2', 'base')
    const scenarios = [
      { endDate: '2026-02-01', profile: 'short', weeks: 4, mesocycles: 1 },
      { endDate: '2026-03-29', profile: 'normal', weeks: 12, mesocycles: 3 },
      { endDate: '2026-06-21', profile: 'long', weeks: 24, mesocycles: 6 },
    ] as const

    for (const scenario of scenarios) {
      const result = generateFractalMacrocycle({
        title: `Plan ${scenario.profile}`,
        goalType: 'base',
        startDate: '2026-01-05',
        endDate: scenario.endDate,
        athleteGroup: 'S2',
        loadStrategy,
      })
      const weeks = result.mesocycles.flatMap((mesocycle) => mesocycle.microcycles)

      assert.equal(result.progressionDurationProfile, scenario.profile)
      assert.equal(result.trainingWeeksCount, scenario.weeks)
      assert.equal(result.mesocycles.length, scenario.mesocycles)
      assert.equal(weeks.length, scenario.weeks)
      assertConsecutiveWeeks(weeks)
    }
  })
})

function assertConsecutiveWeeks(weeks: Array<{ startDate: string; endDate: string }>) {
  for (let index = 1; index < weeks.length; index += 1) {
    const previousEnd = new Date(`${weeks[index - 1].endDate}T00:00:00Z`)
    previousEnd.setUTCDate(previousEnd.getUTCDate() + 1)
    assert.equal(weeks[index].startDate, previousEnd.toISOString().slice(0, 10))
  }
}
