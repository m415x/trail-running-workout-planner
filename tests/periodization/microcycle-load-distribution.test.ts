import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { distributeMesocycleLoad } from '@/lib/periodization/microcycle-load-distribution'

describe('distribución de carga entre microciclos', () => {
  it('eleva progresivamente la carga hasta el pico del mesociclo', () => {
    const result = distributeMesocycleLoad({
      sequence: ['base', 'development', 'shock', 'deload'],
      startingVolumeKm: 30,
      targetPeakVolumeKm: 36,
    })

    assert.deepEqual(result, [
      { type: 'base', targetVolumeKm: 30 },
      { type: 'development', targetVolumeKm: 33 },
      { type: 'shock', targetVolumeKm: 36 },
      { type: 'deload', targetVolumeKm: 30 },
    ])
  })

  it('parte del pico tolerado del bloque anterior', () => {
    const result = distributeMesocycleLoad({
      sequence: ['base', 'development', 'shock', 'deload'],
      startingVolumeKm: 36,
      targetPeakVolumeKm: 42,
    })

    assert.deepEqual(result.map((week) => week.targetVolumeKm), [36, 39, 42, 36])
  })

  it('adapta la distribución a un bloque de tres semanas', () => {
    const result = distributeMesocycleLoad({
      sequence: ['base', 'development', 'deload'],
      startingVolumeKm: 32,
      targetPeakVolumeKm: 36,
    })

    assert.deepEqual(result.map((week) => week.targetVolumeKm), [32, 36, 32])
  })

  it('mantiene estable una estrategia sin margen de crecimiento', () => {
    const result = distributeMesocycleLoad({
      sequence: ['base', 'development', 'shock', 'deload'],
      startingVolumeKm: 36,
      targetPeakVolumeKm: 36,
    })

    assert.deepEqual(result.map((week) => week.targetVolumeKm), [36, 36, 36, 36])
  })

  it('rechaza secuencias vacías o picos inferiores al inicio', () => {
    assert.throws(() => distributeMesocycleLoad({
      sequence: [],
      startingVolumeKm: 30,
      targetPeakVolumeKm: 36,
    }), /al menos un microciclo/)

    assert.throws(() => distributeMesocycleLoad({
      sequence: ['base', 'development', 'deload'],
      startingVolumeKm: 36,
      targetPeakVolumeKm: 30,
    }), /igual o superior/)
  })
})
