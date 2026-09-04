import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { distributeMesocycleLoad } from '@/lib/periodization/microcycle-load-distribution'

describe('distribución de carga entre microciclos', () => {
  it('eleva progresivamente la carga hasta el pico del mesociclo', () => {
    const result = distributeMesocycleLoad({
      sequence: ['base', 'development', 'shock', 'deload'],
      startingVolumeKm: 30,
      targetPeakVolumeKm: 36,
      deloadPercentage: 25,
    })

    assert.deepEqual(result, [
      { type: 'base', targetVolumeKm: 30 },
      { type: 'development', targetVolumeKm: 33 },
      { type: 'shock', targetVolumeKm: 36 },
      { type: 'deload', targetVolumeKm: 27 },
    ])
  })

  it('parte del pico tolerado del bloque anterior', () => {
    const result = distributeMesocycleLoad({
      sequence: ['base', 'development', 'shock', 'deload'],
      startingVolumeKm: 36,
      targetPeakVolumeKm: 42,
      deloadPercentage: 30,
    })

    assert.deepEqual(result.map((week) => week.targetVolumeKm), [36, 39, 42, 29.4])
  })

  it('adapta la distribución a un bloque de tres semanas', () => {
    const result = distributeMesocycleLoad({
      sequence: ['base', 'development', 'deload'],
      startingVolumeKm: 32,
      targetPeakVolumeKm: 36,
      deloadPercentage: 25,
    })

    assert.deepEqual(result.map((week) => week.targetVolumeKm), [32, 36, 27])
  })

  it('mantiene estables las semanas de carga y aplica la descarga configurada', () => {
    const result = distributeMesocycleLoad({
      sequence: ['base', 'development', 'shock', 'deload'],
      startingVolumeKm: 36,
      targetPeakVolumeKm: 36,
      deloadPercentage: 20,
    })

    assert.deepEqual(result.map((week) => week.targetVolumeKm), [36, 36, 36, 28.8])
  })

  it('rechaza secuencias vacías o picos inferiores al inicio', () => {
    assert.throws(() => distributeMesocycleLoad({
      sequence: [],
      startingVolumeKm: 30,
      targetPeakVolumeKm: 36,
      deloadPercentage: 25,
    }), /al menos un microciclo/)

    assert.throws(() => distributeMesocycleLoad({
      sequence: ['base', 'development', 'deload'],
      startingVolumeKm: 36,
      targetPeakVolumeKm: 30,
      deloadPercentage: 25,
    }), /igual o superior/)
  })

  it('rechaza porcentajes de descarga fuera de rango', () => {
    assert.throws(() => distributeMesocycleLoad({
      sequence: ['base', 'development', 'shock', 'deload'],
      startingVolumeKm: 30,
      targetPeakVolumeKm: 36,
      deloadPercentage: 100,
    }), /menor que 100/)
  })
})
