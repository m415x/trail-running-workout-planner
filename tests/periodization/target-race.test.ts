import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolveTargetRace } from '@/lib/periodization/target-race'

describe('carrera objetivo del plan grupal', () => {
  it('normaliza nombre, distancia y desnivel de una carrera', () => {
    assert.deepEqual(resolveTargetRace('race', {
      name: '  Patagonia Run  ',
      distanceKm: '42.2',
      elevationGain: '2400',
    }), {
      name: 'Patagonia Run',
      distanceKm: 42.2,
      elevationGain: 2400,
    })
  })

  it('admite una carrera sin desnivel conocido', () => {
    assert.deepEqual(resolveTargetRace('race', {
      name: '10K local',
      distanceKm: 10,
      elevationGain: '',
    }), {
      name: '10K local',
      distanceKm: 10,
    })
  })

  it('ignora datos de carrera para objetivos que no son de carrera', () => {
    assert.equal(resolveTargetRace('base', {
      name: 'No corresponde',
      distanceKm: 21,
      elevationGain: 500,
    }), null)
  })

  it('rechaza datos obligatorios ausentes o desnivel inválido', () => {
    assert.throws(
      () => resolveTargetRace('race', { distanceKm: 21 }),
      /nombre de la carrera/,
    )
    assert.throws(
      () => resolveTargetRace('race', { name: 'Carrera', distanceKm: 0 }),
      /mayor que cero/,
    )
    assert.throws(
      () => resolveTargetRace('race', {
        name: 'Carrera',
        distanceKm: 21,
        elevationGain: 500.5,
      }),
      /entero no negativo/,
    )
  })
})
