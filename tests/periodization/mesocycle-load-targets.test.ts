import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { calculateMesocycleLoadTargets } from '@/lib/periodization/mesocycle-load-targets'

describe('objetivos de carga por mesociclo', () => {
  it('distribuye el crecimiento hasta alcanzar el máximo en el último bloque', () => {
    const targets = calculateMesocycleLoadTargets({
      initialWeeklyVolumeKm: 30,
      maximumWeeklyVolumeKm: 42,
      mesocycleCount: 3,
    })

    assert.deepEqual(targets, [
      { mesocycleNumber: 1, targetPeakVolumeKm: 34 },
      { mesocycleNumber: 2, targetPeakVolumeKm: 38 },
      { mesocycleNumber: 3, targetPeakVolumeKm: 42 },
    ])
  })

  it('mantiene una carga estable cuando el volumen inicial ya es el máximo', () => {
    const targets = calculateMesocycleLoadTargets({
      initialWeeklyVolumeKm: 36,
      maximumWeeklyVolumeKm: 36,
      mesocycleCount: 3,
    })

    assert.deepEqual(
      targets.map((target) => target.targetPeakVolumeKm),
      [36, 36, 36],
    )
  })

  it('asigna el máximo como objetivo cuando solo existe un mesociclo', () => {
    const [target] = calculateMesocycleLoadTargets({
      initialWeeklyVolumeKm: 35,
      maximumWeeklyVolumeKm: 42,
      mesocycleCount: 1,
    })

    assert.equal(target.mesocycleNumber, 1)
    assert.equal(target.targetPeakVolumeKm, 42)
  })

  it('conserva una precisión decimal estable', () => {
    const targets = calculateMesocycleLoadTargets({
      initialWeeklyVolumeKm: 31.5,
      maximumWeeklyVolumeKm: 40,
      mesocycleCount: 3,
    })

    assert.deepEqual(
      targets.map((target) => target.targetPeakVolumeKm),
      [34.3, 37.2, 40],
    )
  })

  it('rechaza límites invertidos y cantidades de bloques inválidas', () => {
    assert.throws(() => calculateMesocycleLoadTargets({
      initialWeeklyVolumeKm: 42,
      maximumWeeklyVolumeKm: 35,
      mesocycleCount: 3,
    }), /no puede superar/)

    assert.throws(() => calculateMesocycleLoadTargets({
      initialWeeklyVolumeKm: 35,
      maximumWeeklyVolumeKm: 42,
      mesocycleCount: 0,
    }), /entero mayor que cero/)
  })
})
