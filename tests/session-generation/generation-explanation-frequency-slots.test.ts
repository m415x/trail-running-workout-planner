import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  explainFrequencyAndSlots,
} from '@/lib/session-generation/generation-explanation'
import { DEFAULT_WEEKLY_TRAINING_PATTERN } from '@/lib/session-generation/default-weekly-pattern'

describe('GenerationExplanation frequency and slots evidence', () => {
  it('explains fixed frequency as a Coach constraint and preserves habitual slots', () => {
    const result = explainFrequencyAndSlots({
      frequency: { mode: 'fixed', sessionsPerWeek: 3 },
      microcycleType: 'development',
      targetVolumeKm: 40,
      maximumWeeklyVolumeKm: 70,
      includesRace: false,
      pattern: DEFAULT_WEEKLY_TRAINING_PATTERN,
      startDate: '2026-09-07',
      intenseSessionsTarget: 1,
      minimumRecoveryDays: 2,
    })

    assert.equal(result.frequency.stage, 'frequency')
    assert.deepEqual(result.frequency.inputs, [
      { code: 'frequency_mode', value: 'fixed' },
      { code: 'fixed_sessions_per_week', value: 3 },
    ])
    assert.deepEqual(result.frequency.decision, [
      { code: 'selected_session_count', value: 3 },
    ])
    assert.ok(result.slots.decision.some((fact) => (
      fact.code === 'selected_slot_keys' &&
      fact.value === 'weekly-tuesday,weekly-thursday,weekly-saturday'
    )))
    assert.ok(result.slots.consequence.some((fact) => (
      fact.code === 'used_fallback_weekdays' && fact.value === false
    )))
  })

  it('explains AUTO frequency from microcycle/load and a fallback weekday when the habitual pattern is insufficient', () => {
    const result = explainFrequencyAndSlots({
      frequency: { mode: 'auto' },
      microcycleType: 'shock',
      targetVolumeKm: 60,
      maximumWeeklyVolumeKm: 70,
      includesRace: false,
      pattern: {
        slots: DEFAULT_WEEKLY_TRAINING_PATTERN.slots.slice(0, 3),
      },
      startDate: '2026-09-07',
      intenseSessionsTarget: 1,
      minimumRecoveryDays: 2,
    })

    assert.ok(result.frequency.inputs.some((fact) => (
      fact.code === 'microcycle_type' && fact.value === 'shock'
    )))
    assert.ok(result.frequency.inputs.some((fact) => (
      fact.code === 'relative_load_ratio' && fact.value === 0.86
    )))
    assert.deepEqual(result.frequency.decision, [
      { code: 'selected_session_count', value: 5 },
    ])
    assert.ok(result.slots.consequence.some((fact) => (
      fact.code === 'used_fallback_weekdays' && fact.value === true
    )))
    assert.ok(result.slots.constraints.some((fact) => (
      fact.code === 'minimum_recovery_days' && fact.value === 2
    )))
  })

  it('explains race-week slot forcing without treating the habitual pattern as rigid', () => {
    const result = explainFrequencyAndSlots({
      frequency: { mode: 'auto' },
      microcycleType: 'race',
      targetVolumeKm: 20,
      maximumWeeklyVolumeKm: 70,
      includesRace: true,
      raceWeekday: 'sunday',
      pattern: DEFAULT_WEEKLY_TRAINING_PATTERN,
      startDate: '2026-09-07',
      intenseSessionsTarget: 1,
      minimumRecoveryDays: 2,
    })

    assert.ok(result.slots.constraints.some((fact) => (
      fact.code === 'race_weekday' && fact.value === 'sunday'
    )))
    assert.ok(result.slots.decision.some((fact) => (
      fact.code === 'selected_roles' &&
      typeof fact.value === 'string' &&
      fact.value.includes('competition')
    )))
  })
})
