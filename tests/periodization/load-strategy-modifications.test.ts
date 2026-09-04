import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getLoadStrategyModifications } from '@/lib/periodization/load-strategy-modifications'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'

describe('modificaciones manuales de estrategia de carga', () => {
  it('no registra cambios cuando los valores coinciden con la sugerencia', () => {
    const suggested = suggestLoadStrategy('S2', 'race')

    const modifications = getLoadStrategyModifications(suggested.values, { ...suggested.values })

    assert.deepEqual(modifications, [])
  })

  it('registra solamente los valores que difieren de la sugerencia', () => {
    const suggested = suggestLoadStrategy('S2', 'race')
    const actual = {
      ...suggested.values,
      initialWeeklyVolumeKm: 38,
      deloadPercentage: 30,
    }

    const modifications = getLoadStrategyModifications(suggested.values, actual)

    assert.deepEqual(modifications, [
      {
        field: 'load_initial_weekly_volume_km',
        previousValue: '36',
        newValue: '38',
      },
      {
        field: 'load_deload_percentage',
        previousValue: '35',
        newValue: '30',
      },
    ])
  })

  it('registra correctamente cambios entre valores nulos y valores definidos', () => {
    const suggested = suggestLoadStrategy('S2', 'race')
    const withoutElevation = {
      ...suggested.values,
      initialWeeklyElevationGain: null,
    }

    const removedElevation = getLoadStrategyModifications(suggested.values, withoutElevation)

    assert.deepEqual(removedElevation.find(
      (modification) => modification.field === 'load_initial_weekly_elevation_gain',
    ), {
      field: 'load_initial_weekly_elevation_gain',
      previousValue: '720',
      newValue: null,
    })

    const suggestedWithoutElevation = {
      ...suggested.values,
      initialWeeklyElevationGain: null,
    }
    const actualWithElevation = {
      ...suggestedWithoutElevation,
      initialWeeklyElevationGain: 650,
    }

    const addedElevation = getLoadStrategyModifications(
      suggestedWithoutElevation,
      actualWithElevation,
    )

    assert.deepEqual(addedElevation.find(
      (modification) => modification.field === 'load_initial_weekly_elevation_gain',
    ), {
      field: 'load_initial_weekly_elevation_gain',
      previousValue: null,
      newValue: '650',
    })
  })
})
