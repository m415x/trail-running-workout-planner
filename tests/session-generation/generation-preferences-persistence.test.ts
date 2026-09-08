import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  resolveSessionGenerationPreferences,
  serializeSessionGenerationPreferences,
} from '@/lib/session-generation/generation-preferences-persistence'
import {
  buildWeeklyTrainingPattern,
  defaultWeeklyGenerationPreferences,
} from '@/lib/session-generation/generation-preferences'

describe('persistencia de preferencias de generación', () => {
  it('serializa AUTO sin usar una cantidad fija sentinela', () => {
    const serialized = serializeSessionGenerationPreferences(
      defaultWeeklyGenerationPreferences(),
    )

    assert.equal(serialized.frequencyMode, 'auto')
    assert.equal(serialized.fixedSessionsPerWeek, null)
    assert.deepEqual(serialized.weeklyPattern[0], {
      weekday: 'monday',
      role: 'base',
    })
  })

  it('serializa y reconstruye una frecuencia fija y un patrón personalizado', () => {
    const pattern = buildWeeklyTrainingPattern([
      { weekday: 'monday', role: 'recovery' },
      { weekday: 'wednesday', role: 'quality' },
      { weekday: 'friday', role: 'mountain' },
      { weekday: 'sunday', role: 'long' },
    ])

    const serialized = serializeSessionGenerationPreferences({
      frequency: { mode: 'fixed', sessionsPerWeek: 4 },
      pattern,
    })
    const resolved = resolveSessionGenerationPreferences(serialized)

    assert.deepEqual(resolved.frequency, {
      mode: 'fixed',
      sessionsPerWeek: 4,
    })
    assert.deepEqual(
      resolved.pattern.slots.map(({ weekday, role }) => ({ weekday, role })),
      [
        { weekday: 'monday', role: 'recovery' },
        { weekday: 'wednesday', role: 'quality' },
        { weekday: 'friday', role: 'mountain' },
        { weekday: 'sunday', role: 'long' },
      ],
    )
  })

  it('usa el patrón habitual por defecto cuando todavía no hay configuración persistida', () => {
    const resolved = resolveSessionGenerationPreferences(null)

    assert.deepEqual(resolved.frequency, { mode: 'auto' })
    assert.deepEqual(
      resolved.pattern.slots.map((slot) => slot.weekday),
      ['monday', 'tuesday', 'wednesday', 'thursday', 'saturday'],
    )
  })

  it('rechaza estados persistidos inconsistentes', () => {
    assert.throws(
      () => resolveSessionGenerationPreferences({
        frequencyMode: 'auto',
        fixedSessionsPerWeek: 4,
        weeklyPattern: [
          { weekday: 'monday', role: 'base' },
          { weekday: 'thursday', role: 'quality' },
          { weekday: 'saturday', role: 'long' },
        ],
      }),
      Error,
    )

    assert.throws(
      () => resolveSessionGenerationPreferences({
        frequencyMode: 'fixed',
        fixedSessionsPerWeek: null,
        weeklyPattern: [
          { weekday: 'monday', role: 'base' },
          { weekday: 'thursday', role: 'quality' },
          { weekday: 'saturday', role: 'long' },
        ],
      }),
      Error,
    )
  })
})
