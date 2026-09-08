import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { DEFAULT_WEEKLY_TRAINING_PATTERN } from '@/lib/session-generation/default-weekly-pattern'
import { selectWeeklySlots } from '@/lib/session-generation/weekly-generation-rules'
import { distributeWeeklyVolume } from '@/lib/session-generation/weekly-volume-distribution'

const pattern = DEFAULT_WEEKLY_TRAINING_PATTERN.slots

describe('distribución semanal de volumen', () => {
  it('distribuye todo el objetivo en kilómetros prácticos según el peso de los roles', () => {
    const slots = selectWeeklySlots(pattern, 3)
    const result = distributeWeeklyVolume(slots, 40)

    assert.deepEqual(result.allocations.map(({ slotKey, distanceKm }) => ({ slotKey, distanceKm })), [
      { slotKey: 'weekly-tuesday', distanceKm: 12 },
      { slotKey: 'weekly-thursday', distanceKm: 8 },
      { slotKey: 'weekly-saturday', distanceKm: 20 },
    ])
    assert.equal(result.allocatedVolumeKm, 40)
    assert.equal(result.remainingVolumeKm, 0)
    assert.equal(result.isExceeded, false)
    assert.deepEqual(result.warnings, [])
  })

  it('consume primero una ruta fija y reparte exactamente el volumen restante', () => {
    const result = distributeWeeklyVolume(pattern, 60, [{
      slotKey: 'weekly-tuesday',
      flexibility: 'fixed',
      distanceKm: 16,
    }])

    assert.deepEqual(result.allocations.map(({ slotKey, distanceKm }) => ({ slotKey, distanceKm })), [
      { slotKey: 'weekly-monday', distanceKm: 9 },
      { slotKey: 'weekly-tuesday', distanceKm: 16 },
      { slotKey: 'weekly-wednesday', distanceKm: 11 },
      { slotKey: 'weekly-thursday', distanceKm: 7 },
      { slotKey: 'weekly-saturday', distanceKm: 17 },
    ])
    assert.equal(result.allocatedVolumeKm, 60)
    assert.equal(result.remainingVolumeKm, 0)
  })

  it('mantiene rutas fijas que exceden el objetivo y asigna cero a las flexibles', () => {
    const slots = selectWeeklySlots(pattern, 3)
    const result = distributeWeeklyVolume(slots, 12, [{
      slotKey: 'weekly-tuesday',
      flexibility: 'fixed',
      distanceKm: 16,
    }])

    assert.deepEqual(result.allocations.map(({ distanceKm }) => distanceKm), [16, 0, 0])
    assert.equal(result.allocatedVolumeKm, 16)
    assert.equal(result.remainingVolumeKm, -4)
    assert.equal(result.isExceeded, true)
    assert.match(result.warnings[0], /superan el objetivo semanal por 4 km/)
  })

  it('informa volumen pendiente cuando todas las sesiones son fijas', () => {
    const slots = selectWeeklySlots(pattern, 3)
    const result = distributeWeeklyVolume(slots, 40, slots.map((slot) => ({
      slotKey: slot.key,
      flexibility: 'fixed' as const,
      distanceKm: 10,
    })))

    assert.equal(result.allocatedVolumeKm, 30)
    assert.equal(result.remainingVolumeKm, 10)
    assert.match(result.warnings[0], /10 km sin asignar/)
  })

  it('conserva un objetivo decimal explícito sin sesgar siempre el último día', () => {
    const slots = selectWeeklySlots(pattern, 3)
    const result = distributeWeeklyVolume(slots, 40.5)

    assert.equal(result.allocatedVolumeKm, 40.5)
    assert.equal(result.remainingVolumeKm, 0)
    assert.equal(result.allocations.filter(({ distanceKm }) => !Number.isInteger(distanceKm)).length, 1)
    assert.notEqual(result.allocations.at(-1)?.distanceKm, 20.5)
  })

  it('rechaza objetivos, slots y cargas fijas inconsistentes', () => {
    const slots = selectWeeklySlots(pattern, 3)

    assert.throws(() => distributeWeeklyVolume(slots, -1), RangeError)
    assert.throws(() => distributeWeeklyVolume([slots[0], slots[0]], 20), RangeError)
    assert.throws(() => distributeWeeklyVolume(slots, 20, [{
      slotKey: 'unknown', flexibility: 'fixed', distanceKm: 5,
    }]), RangeError)
    assert.throws(() => distributeWeeklyVolume(slots, 20, [{
      slotKey: slots[0].key, flexibility: 'fixed', distanceKm: -5,
    }]), RangeError)
  })
})
