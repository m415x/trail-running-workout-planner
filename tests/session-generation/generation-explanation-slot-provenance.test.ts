import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { explainFrequencyAndSlots } from '@/lib/session-generation/generation-explanation'
import { createWeeklyTrainingSlot } from '@/lib/session-generation/default-weekly-pattern'

describe('GenerationExplanation slot provenance and constraint influence', () => {
  it('identifies habitual, fallback and omitted habitual slots structurally', () => {
    const result = explainFrequencyAndSlots({
      frequency: { mode: 'auto' },
      microcycleType: 'shock',
      targetVolumeKm: 60,
      maximumWeeklyVolumeKm: 70,
      includesRace: false,
      pattern: {
        slots: [
          createWeeklyTrainingSlot('monday', 'quality'),
          createWeeklyTrainingSlot('tuesday', 'mountain'),
          createWeeklyTrainingSlot('wednesday', 'long'),
        ],
      },
      startDate: '2026-09-07',
      intenseSessionsTarget: 1,
      minimumRecoveryDays: 2,
    })

    assert.ok(result.slots.consequence.some((fact) => (
      fact.code === 'selected_habitual_slot_keys' &&
      fact.value === 'weekly-monday,weekly-tuesday,weekly-wednesday'
    )))
    assert.ok(result.slots.consequence.some((fact) => (
      fact.code === 'selected_fallback_slot_keys' &&
      fact.value === 'weekly-thursday,weekly-saturday'
    )))
    assert.ok(result.slots.consequence.some((fact) => (
      fact.code === 'omitted_habitual_slot_keys' &&
      fact.value === ''
    )))
  })

  it('records when recovery constraints change the otherwise preferred slot combination', () => {
    const pattern = {
      slots: [
        createWeeklyTrainingSlot('monday', 'quality'),
        createWeeklyTrainingSlot('tuesday', 'quality'),
        createWeeklyTrainingSlot('wednesday', 'quality'),
        createWeeklyTrainingSlot('thursday', 'quality'),
      ],
    }

    const result = explainFrequencyAndSlots({
      frequency: { mode: 'fixed', sessionsPerWeek: 3 },
      microcycleType: 'development',
      targetVolumeKm: 40,
      maximumWeeklyVolumeKm: 70,
      includesRace: false,
      pattern,
      startDate: '2026-09-07',
      intenseSessionsTarget: 2,
      minimumRecoveryDays: 2,
    })

    assert.ok(result.slots.consequence.some((fact) => (
      fact.code === 'recovery_constraint_changed_selection' && fact.value === true
    )))
    assert.ok(result.slots.consequence.some((fact) => (
      fact.code === 'unconstrained_slot_keys' &&
      fact.value === 'weekly-monday,weekly-tuesday,weekly-wednesday'
    )))
    assert.ok(result.slots.decision.some((fact) => (
      fact.code === 'selected_slot_keys' &&
      fact.value === 'weekly-monday,weekly-tuesday,weekly-thursday'
    )))
    assert.ok(result.slots.consequence.some((fact) => (
      fact.code === 'omitted_habitual_slot_keys' &&
      fact.value === 'weekly-wednesday'
    )))
  })

  it('marks race replacement separately from fallback generation', () => {
    const result = explainFrequencyAndSlots({
      frequency: { mode: 'fixed', sessionsPerWeek: 3 },
      microcycleType: 'race',
      targetVolumeKm: 20,
      maximumWeeklyVolumeKm: 70,
      includesRace: true,
      raceWeekday: 'sunday',
      pattern: {
        slots: [
          createWeeklyTrainingSlot('monday', 'base'),
          createWeeklyTrainingSlot('thursday', 'quality'),
          createWeeklyTrainingSlot('sunday', 'recovery'),
        ],
      },
      startDate: '2026-09-07',
      intenseSessionsTarget: 1,
      minimumRecoveryDays: 2,
    })

    assert.ok(result.slots.consequence.some((fact) => (
      fact.code === 'race_replaced_habitual_slot' && fact.value === true
    )))
    assert.ok(result.slots.consequence.some((fact) => (
      fact.code === 'selected_fallback_slot_keys' && fact.value === ''
    )))
  })
})
