import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { explainIntensityAndRace } from '@/lib/session-generation/generation-explanation'
import { createWeeklyTrainingSlot } from '@/lib/session-generation/default-weekly-pattern'
import type {
  DatedTrainingSlot,
  SessionGenerationIntensityTarget,
} from '@/types/training/session-generation.types'

const trainingSlots: DatedTrainingSlot[] = [
  {
    slot: createWeeklyTrainingSlot('tuesday', 'mountain'),
    date: '2026-09-08',
  },
  {
    slot: createWeeklyTrainingSlot('thursday', 'quality'),
    date: '2026-09-10',
  },
  {
    slot: createWeeklyTrainingSlot('saturday', 'long'),
    date: '2026-09-12',
  },
]

describe('GenerationExplanation intensity and race evidence', () => {
  it('explains selected intense slots and reference-percentage prescription from the resolved target', () => {
    const result = explainIntensityAndRace({
      trainingSlots,
      intensity: intensityTarget({
        defaultMethod: 'reference_percentage',
        referencePercentageTarget: 92,
        intenseSessionsTarget: 1,
        minimumRecoveryDaysBetweenIntenseSessions: 2,
      }),
      competition: null,
      trainingTargetVolumeKm: 40,
      trainingTargetElevationGain: 1200,
    })

    assert.ok(result.intensity.inputs.some((fact) => (
      fact.code === 'default_method' && fact.value === 'reference_percentage'
    )))
    assert.ok(result.intensity.constraints.some((fact) => (
      fact.code === 'minimum_recovery_days' && fact.value === 2
    )))
    assert.ok(result.intensity.decision.some((fact) => (
      fact.code === 'assigned_intense_sessions' && fact.value === 1
    )))
    assert.ok(result.intensity.decision.some((fact) => (
      fact.code === 'slot_intensity' &&
      fact.value === 'weekly-thursday::reference_percentage::92'
    )))
  })

  it('explains fallback to heart-rate zones and preserves the generator warning', () => {
    const result = explainIntensityAndRace({
      trainingSlots,
      intensity: intensityTarget({
        defaultMethod: 'reference_percentage',
        referencePercentageTarget: null,
        intenseSessionsTarget: 1,
        minimumRecoveryDaysBetweenIntenseSessions: 2,
      }),
      competition: null,
      trainingTargetVolumeKm: 40,
      trainingTargetElevationGain: 1200,
    })

    assert.ok(result.intensity.decision.some((fact) => (
      fact.code === 'effective_method' && fact.value === 'hr_zone'
    )))
    assert.ok(result.intensity.warnings.some((warning) => (
      warning.code === 'reference_percentage_target_missing'
    )))
  })

  it('keeps race load separate from the taper training budget and intensity distribution', () => {
    const result = explainIntensityAndRace({
      trainingSlots: trainingSlots.slice(0, 2),
      intensity: intensityTarget({
        defaultMethod: 'hr_zone',
        referencePercentageTarget: null,
        intenseSessionsTarget: 1,
        minimumRecoveryDaysBetweenIntenseSessions: 2,
      }),
      competition: {
        name: 'Trail 25K',
        date: '2026-09-13',
        distanceKm: 25,
        elevationGain: 1400,
      },
      trainingTargetVolumeKm: 18,
      trainingTargetElevationGain: 500,
    })

    assert.ok(result.intensity.inputs.some((fact) => (
      fact.code === 'training_slot_keys' &&
      fact.value === 'weekly-tuesday,weekly-thursday'
    )))
    assert.ok(result.intensity.inputs.every((fact) => (
      typeof fact.value !== 'string' || !fact.value.includes('weekly-sunday')
    )))

    assert.ok(result.race.consequence.some((fact) => (
      fact.code === 'race_load_separate_from_training_budget' && fact.value === true
    )))
    assert.ok(result.race.inputs.some((fact) => (
      fact.code === 'training_target_volume_km' && fact.value === 18
    )))
    assert.ok(result.race.inputs.some((fact) => (
      fact.code === 'race_distance_km' && fact.value === 25
    )))
    assert.ok(result.race.inputs.some((fact) => (
      fact.code === 'training_target_elevation_gain' && fact.value === 500
    )))
    assert.ok(result.race.inputs.some((fact) => (
      fact.code === 'race_elevation_gain' && fact.value === 1400
    )))
  })
})

function intensityTarget(
  overrides: Partial<SessionGenerationIntensityTarget>,
): SessionGenerationIntensityTarget {
  return {
    defaultMethod: 'hr_zone',
    emphasis: 'vo2max',
    intenseSessionsTarget: 1,
    predominantZone: 'Z2',
    referencePercentageTarget: null,
    minimumRecoveryDaysBetweenIntenseSessions: 2,
    ...overrides,
  }
}
