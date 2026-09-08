import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEFAULT_WEEKLY_TRAINING_PATTERN } from '@/lib/session-generation/default-weekly-pattern'
import { distributeWeeklyElevation } from '@/lib/session-generation/weekly-elevation-distribution'
import { selectWeeklySlots } from '@/lib/session-generation/weekly-generation-rules'

const pattern = DEFAULT_WEEKLY_TRAINING_PATTERN.slots

describe('distribución semanal de desnivel', () => {
  it('concentra el D+ en montaña y fondo sin depender de los kilómetros', () => {
    const slots = selectWeeklySlots(pattern, 3)
    const result = distributeWeeklyElevation(slots, 1200)

    assert.deepEqual(
      result.allocations.map(({ slotKey, elevationGain }) => ({ slotKey, elevationGain })),
      [
        { slotKey: 'weekly-tuesday', elevationGain: 470 },
        { slotKey: 'weekly-thursday', elevationGain: 60 },
        { slotKey: 'weekly-saturday', elevationGain: 670 },
      ],
    )
    assert.equal(result.allocatedElevationGain, 1200)
    assert.equal(result.remainingElevationGain, 0)
    assert.equal(result.isExceeded, false)
    assert.deepEqual(result.warnings, [])
  })

  it('consume primero el D+ fijo de una ruta y distribuye exactamente el resto', () => {
    const result = distributeWeeklyElevation(pattern, 1800, [{
      slotKey: 'weekly-tuesday',
      flexibility: 'fixed',
      elevationGain: 900,
    }])

    assert.deepEqual(
      result.allocations.map(({ slotKey, elevationGain }) => ({ slotKey, elevationGain })),
      [
        { slotKey: 'weekly-monday', elevationGain: 60 },
        { slotKey: 'weekly-tuesday', elevationGain: 900 },
        { slotKey: 'weekly-wednesday', elevationGain: 180 },
        { slotKey: 'weekly-thursday', elevationGain: 60 },
        { slotKey: 'weekly-saturday', elevationGain: 600 },
      ],
    )
    assert.equal(result.allocatedElevationGain, 1800)
    assert.equal(result.remainingElevationGain, 0)
  })

  it('mantiene una ruta fija que excede el objetivo sin generar valores negativos', () => {
    const slots = selectWeeklySlots(pattern, 3)
    const result = distributeWeeklyElevation(slots, 700, [{
      slotKey: 'weekly-tuesday',
      flexibility: 'fixed',
      elevationGain: 900,
    }])

    assert.deepEqual(result.allocations.map(({ elevationGain }) => elevationGain), [900, 0, 0])
    assert.equal(result.remainingElevationGain, -200)
    assert.equal(result.isExceeded, true)
    assert.match(result.warnings[0], /superan el objetivo semanal por 200 m D\+/)
  })

  it('no inventa D+ sin objetivo y advierte si una ruta fija ya lo contiene', () => {
    const slots = selectWeeklySlots(pattern, 3)
    const withoutFixed = distributeWeeklyElevation(slots, null)
    const withFixed = distributeWeeklyElevation(slots, null, [{
      slotKey: 'weekly-tuesday',
      flexibility: 'fixed',
      elevationGain: 500,
    }])

    assert.deepEqual(withoutFixed.allocations.map(({ elevationGain }) => elevationGain), [0, 0, 0])
    assert.equal(withoutFixed.remainingElevationGain, null)
    assert.deepEqual(withoutFixed.warnings, [])
    assert.equal(withFixed.allocatedElevationGain, 500)
    assert.equal(withFixed.remainingElevationGain, null)
    assert.match(withFixed.warnings[0], /no tiene un objetivo de desnivel/)
  })

  it('informa el D+ pendiente si todas las sesiones tienen una carga fija', () => {
    const slots = selectWeeklySlots(pattern, 3)
    const result = distributeWeeklyElevation(slots, 1200, slots.map((slot) => ({
      slotKey: slot.key,
      flexibility: 'fixed' as const,
      elevationGain: 300,
    })))

    assert.equal(result.allocatedElevationGain, 900)
    assert.equal(result.remainingElevationGain, 300)
    assert.match(result.warnings[0], /300 m D\+ sin asignar/)
  })

  it('conserva un objetivo que no es múltiplo de diez sin sesgar el último slot', () => {
    const slots = selectWeeklySlots(pattern, 3).map((slot, index) => ({
      ...slot,
      elevationWeight: [1, 2, 1][index],
    }))
    const result = distributeWeeklyElevation(slots, 1215)

    assert.equal(result.allocatedElevationGain, 1215)
    assert.equal(result.remainingElevationGain, 0)
    assert.equal(result.allocations.filter(({ elevationGain }) => elevationGain % 10 !== 0).length, 1)
    assert.equal((result.allocations.at(-1)?.elevationGain ?? 0) % 10, 0)
    assert.equal(result.allocations[1].elevationGain % 10, 5)
  })

  it('rechaza objetivos, slots y desniveles fijos inconsistentes', () => {
    const slots = selectWeeklySlots(pattern, 3)

    assert.throws(() => distributeWeeklyElevation(slots, -1), RangeError)
    assert.throws(() => distributeWeeklyElevation(slots, 10.5), RangeError)
    assert.throws(() => distributeWeeklyElevation([slots[0], slots[0]], 500), RangeError)
    assert.throws(() => distributeWeeklyElevation(slots, 500, [{
      slotKey: 'unknown', flexibility: 'fixed', elevationGain: 200,
    }]), RangeError)
    assert.throws(() => distributeWeeklyElevation(slots, 500, [{
      slotKey: slots[0].key, flexibility: 'fixed', elevationGain: -200,
    }]), RangeError)
  })
})
