import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { distributeWeeklyIntensity } from '@/lib/session-generation/weekly-intensity-distribution'
import type {
  DatedTrainingSlot,
  SessionGenerationIntensityTarget,
  WeeklySessionRole,
} from '@/types/training/session-generation.types'

const datedSlots: DatedTrainingSlot[] = [
  dated('monday', 'base', '2026-09-07'),
  dated('tuesday', 'mountain', '2026-09-08'),
  dated('thursday', 'quality', '2026-09-10'),
  dated('saturday', 'long', '2026-09-12'),
]

const zoneTarget: SessionGenerationIntensityTarget = {
  defaultMethod: 'hr_zone',
  emphasis: 'threshold',
  intenseSessionsTarget: 2,
  predominantZone: 'Z2',
  pamPercentageTarget: null,
  minimumRecoveryDaysBetweenIntenseSessions: 2,
}

describe('distribución semanal de intensidad', () => {
  it('ubica los estímulos de mayor prioridad respetando días completos de recuperación', () => {
    const result = distributeWeeklyIntensity(datedSlots, zoneTarget)

    assert.equal(result.assignedIntenseSessions, 2)
    assert.deepEqual(
      result.allocations.map(({ slotKey, isIntense, zone }) => ({ slotKey, isIntense, zone })),
      [
        { slotKey: 'monday', isIntense: false, zone: 'Z2' },
        { slotKey: 'tuesday', isIntense: true, zone: 'Z4' },
        { slotKey: 'thursday', isIntense: false, zone: 'Z2' },
        { slotKey: 'saturday', isIntense: true, zone: 'Z4' },
      ],
    )
    assert.deepEqual(result.warnings, [])
  })

  it('aplica PAM únicamente a los estímulos intensos seleccionados', () => {
    const result = distributeWeeklyIntensity(datedSlots, {
      ...zoneTarget,
      defaultMethod: 'pam_percentage',
      emphasis: 'vo2max',
      intenseSessionsTarget: 1,
      pamPercentageTarget: 95,
    })
    const intense = result.allocations.find(({ isIntense }) => isIntense)
    const regular = result.allocations.filter(({ isIntense }) => !isIntense)

    assert.deepEqual(intense, {
      slotKey: 'thursday',
      date: '2026-09-10',
      isIntense: true,
      intensityMethod: 'pam_percentage',
      zone: null,
      pamPercentage: 95,
    })
    assert.ok(regular.every(({ intensityMethod, zone }) => intensityMethod === 'hr_zone' && zone === 'Z2'))
  })

  it('mantiene Z1 en un slot de recuperación aunque predomine otra zona', () => {
    const slots = [dated('monday', 'recovery', '2026-09-07'), datedSlots[2]]
    const result = distributeWeeklyIntensity(slots, {
      ...zoneTarget,
      intenseSessionsTarget: 0,
    })

    assert.deepEqual(result.allocations.map(({ zone }) => zone), ['Z1', 'Z2'])
  })

  it('advierte cuando la separación requerida impide cumplir el objetivo', () => {
    const result = distributeWeeklyIntensity(datedSlots.slice(0, 3), {
      ...zoneTarget,
      minimumRecoveryDaysBetweenIntenseSessions: 3,
    })

    assert.equal(result.assignedIntenseSessions, 1)
    assert.equal(result.allocations.find(({ isIntense }) => isIntense)?.slotKey, 'thursday')
    assert.match(result.warnings[0], /1 de 2 sesiones intensas/)
  })

  it('cae a zonas si PAM no tiene un porcentaje ejecutable', () => {
    const result = distributeWeeklyIntensity(datedSlots, {
      ...zoneTarget,
      defaultMethod: 'pam_percentage',
      intenseSessionsTarget: 1,
      pamPercentageTarget: null,
    })

    assert.ok(result.allocations.every(({ intensityMethod }) => intensityMethod === 'hr_zone'))
    assert.equal(result.allocations.find(({ isIntense }) => isIntense)?.zone, 'Z4')
    assert.match(result.warnings[0], /no tiene un porcentaje objetivo/)
  })

  it('rechaza objetivos, recuperación, fechas y slots inconsistentes', () => {
    assert.throws(() => distributeWeeklyIntensity(datedSlots, {
      ...zoneTarget, intenseSessionsTarget: 5,
    }), RangeError)
    assert.throws(() => distributeWeeklyIntensity(datedSlots, {
      ...zoneTarget, minimumRecoveryDaysBetweenIntenseSessions: -1,
    }), RangeError)
    assert.throws(() => distributeWeeklyIntensity([datedSlots[0], datedSlots[0]], {
      ...zoneTarget, intenseSessionsTarget: 1,
    }), RangeError)
    assert.throws(() => distributeWeeklyIntensity([dated('bad', 'base', '09/07/2026')], {
      ...zoneTarget, intenseSessionsTarget: 0,
    }), RangeError)
  })
})

function dated(key: string, role: WeeklySessionRole, date: string): DatedTrainingSlot {
  return {
    slot: {
      key,
      weekday: date === '2026-09-07' ? 'monday' :
        date === '2026-09-08' ? 'tuesday' :
          date === '2026-09-10' ? 'thursday' : 'saturday',
      role,
      preferredWorkoutTypes: role === 'quality' ? ['Intervals'] : ['Base'],
    },
    date,
  }
}
