import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { GROUP_VOLUME_MATRIX } from '@/data/periodization-matrix'
import { generateFractalMacrocycle } from '@/lib/periodization/macrocycle-generator'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'

import type { AthleteGroupCode, LoadStrategyDraft } from '@/types'

const athleteGroups = Object.keys(GROUP_VOLUME_MATRIX) as AthleteGroupCode[]

function generatePlanning(loadStrategy: LoadStrategyDraft) {
  return generateFractalMacrocycle({
    title: `Plan ${loadStrategy.context.athleteGroup}`,
    goalType: loadStrategy.context.goalType,
    startDate: '2026-01-05',
    endDate: '2026-03-01',
    athleteGroup: loadStrategy.context.athleteGroup,
    loadStrategy,
  })
}

describe('integración de volumen y desnivel', () => {
  it('genera D+ válido y limitado para todos los grupos', () => {
    for (const athleteGroup of athleteGroups) {
      const strategy = suggestLoadStrategy(athleteGroup, 'performance')
      const planning = generatePlanning(strategy)
      const weeks = planning.mesocycles.flatMap((mesocycle) => mesocycle.microcycles)
      const maximumElevation = strategy.values.maximumWeeklyElevationGain

      assert.notEqual(maximumElevation, null)
      assert.equal(weeks.every((week) => (
        week.targetElevationGain !== null
        && Number.isInteger(week.targetElevationGain)
        && week.targetElevationGain >= 0
        && week.targetElevationGain <= (maximumElevation ?? 0)
        && week.targetElevationSource === 'generated'
      )), true, `D+ inválido para ${athleteGroup}`)

      for (const mesocycle of planning.mesocycles) {
        const finalWeek = mesocycle.microcycles.at(-1)
        const previousWeek = mesocycle.microcycles.at(-2)

        assert.equal(finalWeek?.type, 'deload')
        assert.equal(
          (finalWeek?.targetElevationGain ?? 0) < (previousWeek?.targetElevationGain ?? 0),
          true,
          `La descarga vertical no reduce el D+ para ${athleteGroup}`,
        )
      }
    }
  })

  it('no inventa D+ cuando la estrategia vertical está desactivada', () => {
    for (const athleteGroup of athleteGroups) {
      const strategy = suggestLoadStrategy(athleteGroup, 'maintenance')
      strategy.values.initialWeeklyElevationGain = null
      strategy.values.maximumWeeklyElevationGain = null
      const planning = generatePlanning(strategy)

      assert.equal(planning.mesocycles.every((mesocycle) => (
        mesocycle.targetPeakElevationGain === null
        && mesocycle.microcycles.every((week) => (
          week.targetElevationGain === null
          && week.targetElevationSource === 'generated'
        ))
      )), true, `Se inventó D+ para ${athleteGroup}`)
    }
  })

  it('diferencia una carrera con D+ conocido de otra sin ese dato', () => {
    const strategy = suggestLoadStrategy('S2', 'race')
    const common = {
      goalType: 'race' as const,
      startDate: '2026-01-05',
      endDate: '2026-03-29',
      athleteGroup: 'S2' as const,
      loadStrategy: strategy,
    }
    const knownElevation = generateFractalMacrocycle({
      ...common,
      title: 'Trail con D+',
      race: { name: 'Trail', distanceKm: 42, elevationGain: 2_400 },
    })
    const unknownElevation = generateFractalMacrocycle({
      ...common,
      title: 'Trail sin D+',
      race: { name: 'Trail', distanceKm: 42 },
    })
    const knownRaceWeek = knownElevation.mesocycles.at(-1)?.microcycles.at(-1)
    const unknownRaceWeek = unknownElevation.mesocycles.at(-1)?.microcycles.at(-1)

    assert.equal(knownRaceWeek?.type, 'race')
    assert.equal(knownRaceWeek?.targetElevationGain, 2_400)
    assert.equal(unknownRaceWeek?.type, 'race')
    assert.equal(unknownRaceWeek?.targetElevationGain, null)
  })
})
