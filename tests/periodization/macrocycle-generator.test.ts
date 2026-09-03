import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  determineTaperingWeeksCount,
  generateFractalMacrocycle,
} from '@/lib/periodization/macrocycle-generator'

describe('generación de planificación', () => {
  it('genera un objetivo sin carrera sin tapering ni bloque competitivo', () => {
    const result = generateFractalMacrocycle({
      title: '  Base S2  ',
      goalType: 'base',
      startDate: '2026-01-05',
      endDate: '2026-03-01',
      athleteGroup: 'S2',
    })

    const weeks = result.mesocycles.flatMap((mesocycle) => mesocycle.microcycles)
    assert.equal(result.title, 'Base S2')
    assert.equal(result.taperingWeeksCount, 0)
    assert.equal(result.race, null)
    assert.equal(result.mesocycles.some((mesocycle) => mesocycle.period === 'competitive'), false)
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
    }), /requiere los datos de la carrera/)
  })
})

function assertConsecutiveWeeks(weeks: Array<{ startDate: string; endDate: string }>) {
  for (let index = 1; index < weeks.length; index += 1) {
    const previousEnd = new Date(`${weeks[index - 1].endDate}T00:00:00Z`)
    previousEnd.setUTCDate(previousEnd.getUTCDate() + 1)
    assert.equal(weeks[index].startDate, previousEnd.toISOString().slice(0, 10))
  }
}
