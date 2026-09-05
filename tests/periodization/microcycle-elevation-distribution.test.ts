import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { distributeMesocycleElevation } from '@/lib/periodization/microcycle-elevation-distribution'

describe('distribución de desnivel entre microciclos', () => {
  it('eleva el D+ hasta el pico y aplica la descarga configurada', () => {
    const result = distributeMesocycleElevation({
      sequence: ['base', 'development', 'shock', 'deload'],
      startingElevationGain: 900,
      targetPeakElevationGain: 1_200,
      deloadPercentage: 25,
      maximumWeeklyIncreasePercentage: 20,
    })

    assert.deepEqual(result.map((week) => week.targetElevationGain), [900, 1_050, 1_200, 900])
  })

  it('limita los incrementos y redondea a decenas de metros sin exceder el límite', () => {
    const result = distributeMesocycleElevation({
      sequence: ['base', 'development', 'shock', 'deload'],
      startingElevationGain: 1_000,
      targetPeakElevationGain: 1_800,
      deloadPercentage: 20,
      maximumWeeklyIncreasePercentage: 8,
    })

    assert.deepEqual(result.map((week) => week.targetElevationGain), [1_000, 1_080, 1_160, 930])
  })

  it('permite iniciar desde cero sin bloquear toda la progresión', () => {
    const result = distributeMesocycleElevation({
      sequence: ['base', 'development', 'deload'],
      startingElevationGain: 0,
      targetPeakElevationGain: 600,
      deloadPercentage: 20,
      maximumWeeklyIncreasePercentage: 10,
    })

    assert.deepEqual(result.map((week) => week.targetElevationGain), [0, 600, 480])
  })

  it('rechaza secuencias y restricciones inválidas', () => {
    assert.throws(() => distributeMesocycleElevation({
      sequence: [],
      startingElevationGain: 900,
      targetPeakElevationGain: 1_200,
      deloadPercentage: 20,
      maximumWeeklyIncreasePercentage: 10,
    }), /al menos un microciclo/)

    assert.throws(() => distributeMesocycleElevation({
      sequence: ['base', 'deload'],
      startingElevationGain: 1_200,
      targetPeakElevationGain: 900,
      deloadPercentage: 20,
      maximumWeeklyIncreasePercentage: 10,
    }), /igual o superior/)
  })
})
