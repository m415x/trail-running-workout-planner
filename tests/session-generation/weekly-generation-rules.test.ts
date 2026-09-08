import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  calculateWeeklyLoadBudget,
  distributeWeeklyLoad,
  isPamPreferred,
  resolveWeeklySessionCount,
  selectIntenseSlots,
  selectWeeklySlots,
} from '@/lib/session-generation/weekly-generation-rules'
import type {
  SessionGenerationIntensityTarget,
  WeeklyTrainingSlot,
} from '@/types/training/session-generation.types'

const coachPattern: WeeklyTrainingSlot[] = [
  {
    key: 'monday-base',
    weekday: 'monday',
    role: 'base',
    preferredWorkoutTypes: ['Base'],
  },
  {
    key: 'tuesday-mountain',
    weekday: 'tuesday',
    role: 'mountain',
    preferredWorkoutTypes: ['Trail', 'Hills'],
  },
  {
    key: 'wednesday-long',
    weekday: 'wednesday',
    role: 'long',
    preferredWorkoutTypes: ['Long', 'Fartlek'],
  },
  {
    key: 'thursday-quality',
    weekday: 'thursday',
    role: 'quality',
    preferredWorkoutTypes: ['Intervals', 'PAM'],
  },
  {
    key: 'saturday-long',
    weekday: 'saturday',
    role: 'long',
    preferredWorkoutTypes: ['Trail', 'Long'],
    volumeWeight: 1.9,
    elevationWeight: 2,
  },
]

describe('reglas semanales de generación de sesiones', () => {
  it('resuelve 3, 4 o 5 sesiones en modo automático según microciclo y carga relativa', () => {
    assert.equal(autoCount('development', 30, 60), 3)
    assert.equal(autoCount('development', 40, 60), 4)
    assert.equal(autoCount('development', 55, 60), 5)
    assert.equal(autoCount('shock', 50, 60), 5)
    assert.equal(autoCount('deload', 50, 60), 3)
  })

  it('permite 3 o 4 sesiones en tapering según la carga relativa', () => {
    assert.equal(autoCount('tapering', 30, 60), 3)
    assert.equal(autoCount('tapering', 40, 60), 4)
  })

  it('cuenta la carrera como una de las sesiones de la semana competitiva', () => {
    assert.equal(autoCount('race', 40, 60, true), 3)
    assert.equal(autoCount('race', 40, 60, false), 4)
    assert.equal(autoCount('race', 30, 60, false), 3)
  })

  it('respeta una frecuencia fija válida y rechaza valores fuera del MVP', () => {
    assert.equal(
      resolveWeeklySessionCount({
        frequency: { mode: 'fixed', sessionsPerWeek: 5 },
        microcycleType: 'deload',
        targetVolumeKm: 30,
        maximumWeeklyVolumeKm: 60,
      }),
      5,
    )

    assert.throws(
      () =>
        resolveWeeklySessionCount({
          frequency: { mode: 'fixed', sessionsPerWeek: 6 },
          microcycleType: 'base',
          targetVolumeKm: 30,
          maximumWeeklyVolumeKm: 60,
        }),
      RangeError,
    )
  })

  it('reduce el patrón habitual a martes/jueves/sábado y agrega lunes para cuatro sesiones', () => {
    assert.deepEqual(
      selectWeeklySlots(coachPattern, 3).map((slot) => slot.key),
      ['tuesday-mountain', 'thursday-quality', 'saturday-long'],
    )
    assert.deepEqual(
      selectWeeklySlots(coachPattern, 4).map((slot) => slot.key),
      ['monday-base', 'tuesday-mountain', 'thursday-quality', 'saturday-long'],
    )
  })

  it('adapta la prioridad de roles al tipo de microciclo', () => {
    assert.deepEqual(
      selectWeeklySlots(coachPattern, 3, { microcycleType: 'base' }).map((slot) => slot.key),
      ['monday-base', 'wednesday-long', 'saturday-long'],
    )
    assert.deepEqual(
      selectWeeklySlots(coachPattern, 3, { microcycleType: 'tapering' }).map((slot) => slot.key),
      ['monday-base', 'wednesday-long', 'thursday-quality'],
    )
    assert.deepEqual(
      selectWeeklySlots(coachPattern, 3, { microcycleType: 'shock' }).map((slot) => slot.key),
      ['tuesday-mountain', 'thursday-quality', 'saturday-long'],
    )
    assert.deepEqual(
      selectWeeklySlots(coachPattern, 3, { microcycleType: 'deload' }).map((slot) => slot.key),
      ['monday-base', 'wednesday-long', 'saturday-long'],
    )
  })

  it('mantiene el patrón personalizado como preferencia y completa días solo si hacen falta', () => {
    const customPattern = [coachPattern[0], coachPattern[3], coachPattern[4]]

    assert.deepEqual(
      selectWeeklySlots(customPattern, 3).map((slot) => slot.key),
      ['monday-base', 'thursday-quality', 'saturday-long'],
    )
    assert.deepEqual(
      selectWeeklySlots(customPattern, 5).map((slot) => slot.weekday),
      ['monday', 'tuesday', 'wednesday', 'thursday', 'saturday'],
    )
  })

  it('reserva la fecha de carrera dentro del total semanal', () => {
    const selected = selectWeeklySlots(coachPattern, 3, {
      microcycleType: 'race',
      includesRace: true,
      raceWeekday: 'saturday',
    })

    assert.equal(selected.length, 3)
    assert.deepEqual(selected.map(({ weekday, role }) => ({ weekday, role })), [
      { weekday: 'monday', role: 'base' },
      { weekday: 'thursday', role: 'quality' },
      { weekday: 'saturday', role: 'competition' },
    ])
    assert.throws(
      () => selectWeeklySlots(coachPattern, 3, { includesRace: true }),
      RangeError,
    )
  })

  it('elige una combinación que permita separar los estímulos intensos', () => {
    const selected = selectWeeklySlots(coachPattern, 3, {
      microcycleType: 'development',
      weekStartDate: '2026-09-07',
      intenseSessionsTarget: 2,
      minimumRecoveryDays: 2,
    })
    const dated = selected.map((slot) => ({
      slot,
      date: {
        monday: '2026-09-07',
        tuesday: '2026-09-08',
        wednesday: '2026-09-09',
        thursday: '2026-09-10',
        friday: '2026-09-11',
        saturday: '2026-09-12',
        sunday: '2026-09-13',
      }[slot.weekday],
    }))

    assert.equal(selectIntenseSlots(dated, 2, 2).length, 2)
  })

  it('rechaza patrones ambiguos y cantidades de slots inválidas', () => {
    assert.throws(() => selectWeeklySlots([coachPattern[0], coachPattern[0]], 1), RangeError)
    assert.throws(() => selectWeeklySlots(coachPattern, 4.5), RangeError)
    assert.throws(() => selectWeeklySlots(coachPattern, 8), RangeError)
  })

  it('consume primero un circuito fijo y reparte el resto entre sesiones flexibles', () => {
    const allocations = distributeWeeklyLoad(coachPattern, 60, 1800, [
      {
        slotKey: 'tuesday-mountain',
        flexibility: 'fixed',
        distanceKm: 16,
        elevationGain: 900,
      },
    ])

    const budget = calculateWeeklyLoadBudget(60, 1800, allocations)
    const fixed = allocations.find((allocation) => allocation.slotKey === 'tuesday-mountain')

    assert.deepEqual(fixed, {
      slotKey: 'tuesday-mountain',
      flexibility: 'fixed',
      distanceKm: 16,
      elevationGain: 900,
    })
    assert.equal(budget.allocatedVolumeKm, 60)
    assert.equal(budget.allocatedElevationGain, 1800)
    assert.equal(budget.remainingVolumeKm, 0)
    assert.equal(budget.remainingElevationGain, 0)
  })

  it('mantiene el exceso visible cuando un circuito fijo supera el presupuesto', () => {
    const budget = calculateWeeklyLoadBudget(12, 700, [
      {
        slotKey: 'tuesday-mountain',
        flexibility: 'fixed',
        distanceKm: 16,
        elevationGain: 900,
      },
    ])

    assert.equal(budget.remainingVolumeKm, -4)
    assert.equal(budget.remainingElevationGain, -200)
    assert.equal(budget.isVolumeExceeded, true)
    assert.equal(budget.isElevationExceeded, true)
  })

  it('selecciona sesiones intensas respetando días completos de recuperación', () => {
    const dated = [
      { slot: coachPattern[0], date: '2026-09-07' },
      { slot: coachPattern[1], date: '2026-09-08' },
      { slot: coachPattern[3], date: '2026-09-10' },
      { slot: coachPattern[4], date: '2026-09-12' },
    ]

    assert.deepEqual(
      selectIntenseSlots(dated, 1, 2).map(({ slot }) => slot.key),
      ['thursday-quality'],
    )
    assert.deepEqual(
      selectIntenseSlots(dated, 2, 2).map(({ slot }) => slot.key),
      ['tuesday-mountain', 'saturday-long'],
    )
  })

  it('prefiere PAM solo en el último jueves cuando la planificación lo permite', () => {
    const intensity: SessionGenerationIntensityTarget = {
      defaultMethod: 'pam_percentage',
      emphasis: 'vo2max',
      intenseSessionsTarget: 1,
      predominantZone: 'Z2',
      pamPercentageTarget: 92,
      minimumRecoveryDaysBetweenIntenseSessions: 2,
    }

    assert.equal(isPamPreferred('2026-09-24', 'quality', intensity), true)
    assert.equal(isPamPreferred('2026-09-17', 'quality', intensity), false)
    assert.equal(
      isPamPreferred('2026-09-24', 'quality', { ...intensity, emphasis: 'recovery' }),
      false,
    )
  })
})

function autoCount(
  microcycleType: 'base' | 'development' | 'shock' | 'deload' | 'tapering' | 'race',
  targetVolumeKm: number,
  maximumWeeklyVolumeKm: number,
  includesRace = false,
) {
  return resolveWeeklySessionCount({
    frequency: { mode: 'auto' },
    microcycleType,
    targetVolumeKm,
    maximumWeeklyVolumeKm,
    includesRace,
  })
}
