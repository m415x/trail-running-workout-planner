import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { explainIntensityAndRace } from '@/lib/session-generation/generation-explanation'
import { createWeeklyTrainingSlot } from '@/lib/session-generation/default-weekly-pattern'
import type { DatedTrainingSlot } from '@/types/training/session-generation.types'

const crowdedWeek: DatedTrainingSlot[] = [
  {
    slot: createWeeklyTrainingSlot('tuesday', 'quality'),
    date: '2026-09-08',
  },
  {
    slot: createWeeklyTrainingSlot('thursday', 'mountain'),
    date: '2026-09-10',
  },
  {
    slot: createWeeklyTrainingSlot('saturday', 'long'),
    date: '2026-09-12',
  },
]

describe('GenerationExplanation intensity warnings', () => {
  it('preserves the unmet intense-session target when recovery constraints prevent full assignment', () => {
    const result = explainIntensityAndRace({
      trainingSlots: crowdedWeek,
      intensity: {
        defaultMethod: 'hr_zone',
        emphasis: 'threshold',
        intenseSessionsTarget: 3,
        predominantZone: 'Z2',
        referencePercentageTarget: null,
        minimumRecoveryDaysBetweenIntenseSessions: 2,
      },
      competition: null,
      trainingTargetVolumeKm: 36,
      trainingTargetElevationGain: 900,
    })

    assert.ok(result.intensity.constraints.some((fact) => (
      fact.code === 'intense_sessions_target' && fact.value === 3
    )))
    assert.ok(result.intensity.decision.some((fact) => (
      fact.code === 'assigned_intense_sessions' && fact.value === 2
    )))
    assert.ok(result.intensity.warnings.some((warning) => (
      warning.code === 'intense_sessions_not_fully_assigned' &&
      warning.facts.some((fact) => (
        fact.code === 'intense_sessions_target' && fact.value === 3
      )) &&
      warning.facts.some((fact) => (
        fact.code === 'assigned_intense_sessions' && fact.value === 2
      )) &&
      warning.facts.some((fact) => (
        fact.code === 'minimum_recovery_days' && fact.value === 2
      ))
    )))
  })

  it('does not report a race-budget separation when no competition exists', () => {
    const result = explainIntensityAndRace({
      trainingSlots: crowdedWeek,
      intensity: {
        defaultMethod: 'hr_zone',
        emphasis: 'aerobic',
        intenseSessionsTarget: 1,
        predominantZone: 'Z2',
        referencePercentageTarget: null,
        minimumRecoveryDaysBetweenIntenseSessions: 1,
      },
      competition: null,
      trainingTargetVolumeKm: 36,
      trainingTargetElevationGain: 900,
    })

    assert.ok(result.race.decision.some((fact) => (
      fact.code === 'competition_present' && fact.value === false
    )))
    assert.ok(result.race.consequence.some((fact) => (
      fact.code === 'race_load_separate_from_training_budget' && fact.value === false
    )))
    assert.equal(
      result.race.inputs.some((fact) => fact.code.startsWith('race_')),
      false,
    )
  })
})
