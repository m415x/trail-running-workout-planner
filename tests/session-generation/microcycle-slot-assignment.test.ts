import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { assignSlotsToMicrocycle } from '@/lib/session-generation/microcycle-slot-assignment'
import type { WeeklyTrainingSlot } from '@/types/training/session-generation.types'

const slots: WeeklyTrainingSlot[] = [
  slot('monday-base', 'monday'),
  slot('thursday-quality', 'thursday'),
  slot('saturday-long', 'saturday'),
]

describe('asignación automática de sesiones al microciclo', () => {
  it('fecha todos los slots dentro de una semana y hereda un único microciclo', () => {
    const result = assignSlotsToMicrocycle({
      microcycleId: 'microcycle-12',
      startDate: '2026-09-07',
      endDate: '2026-09-13',
    }, slots)

    assert.deepEqual(
      result.assignments.map(({ slot, date, microcycleId }) => ({
        slotKey: slot.key,
        date,
        microcycleId,
      })),
      [
        { slotKey: 'monday-base', date: '2026-09-07', microcycleId: 'microcycle-12' },
        { slotKey: 'thursday-quality', date: '2026-09-10', microcycleId: 'microcycle-12' },
        { slotKey: 'saturday-long', date: '2026-09-12', microcycleId: 'microcycle-12' },
      ],
    )
    assert.deepEqual(result.omittedSlotKeys, [])
    assert.deepEqual(result.warnings, [])
  })

  it('funciona con una semana editada que cruza de domingo a lunes', () => {
    const result = assignSlotsToMicrocycle({
      microcycleId: 'microcycle-edited',
      startDate: '2026-09-09',
      endDate: '2026-09-15',
    }, slots)

    assert.deepEqual(result.assignments.map(({ slot, date }) => [slot.key, date]), [
      ['thursday-quality', '2026-09-10'],
      ['saturday-long', '2026-09-12'],
      ['monday-base', '2026-09-14'],
    ])
  })

  it('no desplaza a otra semana los slots fuera de un microciclo abreviado', () => {
    const result = assignSlotsToMicrocycle({
      microcycleId: 'microcycle-short',
      startDate: '2026-09-08',
      endDate: '2026-09-12',
    }, slots)

    assert.deepEqual(result.assignments.map(({ slot }) => slot.key), [
      'thursday-quality',
      'saturday-long',
    ])
    assert.deepEqual(result.omittedSlotKeys, ['monday-base'])
    assert.match(result.warnings[0], /monday-base.*2026-09-08 a 2026-09-12/)
  })

  it('acepta un microciclo de un solo día', () => {
    const result = assignSlotsToMicrocycle({
      microcycleId: 'microcycle-race',
      startDate: '2026-09-12',
      endDate: '2026-09-12',
    }, slots)

    assert.deepEqual(result.assignments.map(({ slot }) => slot.key), ['saturday-long'])
    assert.deepEqual(result.omittedSlotKeys, ['monday-base', 'thursday-quality'])
  })

  it('rechaza rangos e identidades que no representan un microciclo válido', () => {
    assert.throws(() => assignSlotsToMicrocycle({
      microcycleId: '', startDate: '2026-09-07', endDate: '2026-09-13',
    }, slots), RangeError)
    assert.throws(() => assignSlotsToMicrocycle({
      microcycleId: 'micro', startDate: '2026-02-30', endDate: '2026-03-01',
    }, slots), RangeError)
    assert.throws(() => assignSlotsToMicrocycle({
      microcycleId: 'micro', startDate: '2026-09-14', endDate: '2026-09-13',
    }, slots), RangeError)
    assert.throws(() => assignSlotsToMicrocycle({
      microcycleId: 'micro', startDate: '2026-09-01', endDate: '2026-09-09',
    }, slots), RangeError)
  })

  it('rechaza slots duplicados por identidad o día', () => {
    const duplicateKey = [slots[0], { ...slots[1], key: slots[0].key }]
    const duplicateDay = [slots[0], { ...slots[1], weekday: slots[0].weekday }]
    const context = {
      microcycleId: 'micro', startDate: '2026-09-07', endDate: '2026-09-13',
    }

    assert.throws(() => assignSlotsToMicrocycle(context, duplicateKey), RangeError)
    assert.throws(() => assignSlotsToMicrocycle(context, duplicateDay), RangeError)
  })
})

function slot(key: string, weekday: WeeklyTrainingSlot['weekday']): WeeklyTrainingSlot {
  return {
    key,
    weekday,
    role: key.includes('quality') ? 'quality' : key.includes('long') ? 'long' : 'base',
    preferredWorkoutTypes: ['Base'],
  }
}
