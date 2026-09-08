import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildWeeklyTrainingPattern,
  defaultWeeklyGenerationPreferences,
  parseWeeklySessionFrequency,
} from '@/lib/session-generation/generation-preferences'

describe('preferencias de generación semanal', () => {
  it('interpreta el campo vacío como frecuencia automática', () => {
    assert.deepEqual(parseWeeklySessionFrequency(''), { mode: 'auto' })
    assert.deepEqual(parseWeeklySessionFrequency('   '), { mode: 'auto' })
  })

  it('interpreta 3, 4 o 5 como frecuencia fija', () => {
    assert.deepEqual(parseWeeklySessionFrequency('3'), { mode: 'fixed', sessionsPerWeek: 3 })
    assert.deepEqual(parseWeeklySessionFrequency('5'), { mode: 'fixed', sessionsPerWeek: 5 })
  })

  it('rechaza frecuencias fijas fuera del alcance del MVP', () => {
    assert.throws(() => parseWeeklySessionFrequency('2'), RangeError)
    assert.throws(() => parseWeeklySessionFrequency('6'), RangeError)
    assert.throws(() => parseWeeklySessionFrequency('4.5'), RangeError)
  })

  it('construye el patrón habitual derivando preferencias desde el rol', () => {
    const pattern = buildWeeklyTrainingPattern([
      { weekday: 'monday', role: 'base' },
      { weekday: 'tuesday', role: 'mountain' },
      { weekday: 'thursday', role: 'quality' },
      { weekday: 'saturday', role: 'long' },
    ])

    assert.deepEqual(pattern.slots.map((slot) => slot.key), [
      'weekly-monday',
      'weekly-tuesday',
      'weekly-thursday',
      'weekly-saturday',
    ])
    assert.deepEqual(pattern.slots[1].preferredWorkoutTypes, ['Trail', 'Hills'])
    assert.deepEqual(pattern.slots[2].preferredTemplateCategories, ['quality'])
  })

  it('rechaza días repetidos y roles inválidos', () => {
    assert.throws(
      () => buildWeeklyTrainingPattern([
        { weekday: 'monday', role: 'base' },
        { weekday: 'monday', role: 'quality' },
        { weekday: 'saturday', role: 'long' },
      ]),
      RangeError,
    )

    assert.throws(
      () => buildWeeklyTrainingPattern([
        { weekday: 'monday', role: 'base' },
        { weekday: 'thursday', role: 'magic' },
        { weekday: 'saturday', role: 'long' },
      ]),
      RangeError,
    )
  })

  it('provee el patrón habitual de referencia en modo automático', () => {
    const preferences = defaultWeeklyGenerationPreferences()

    assert.deepEqual(preferences.frequency, { mode: 'auto' })
    assert.deepEqual(
      preferences.pattern.slots.map(({ weekday, role }) => ({ weekday, role })),
      [
        { weekday: 'monday', role: 'base' },
        { weekday: 'tuesday', role: 'mountain' },
        { weekday: 'wednesday', role: 'long' },
        { weekday: 'thursday', role: 'quality' },
        { weekday: 'saturday', role: 'long' },
      ],
    )
  })
})
