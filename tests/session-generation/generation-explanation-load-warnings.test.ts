import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { explainTemplatesAndLoad } from '@/lib/session-generation/generation-explanation'
import { createWeeklyTrainingSlot } from '@/lib/session-generation/default-weekly-pattern'
import type { WeeklyTrainingSlot } from '@/types/training/session-generation.types'
import type { WorkoutTemplate } from '@/types/training/workout-template.types'

describe('GenerationExplanation template/load warnings', () => {
  it('keeps no-compatible-template as structured evidence', () => {
    const result = explainTemplatesAndLoad({
      templates: [],
      teamId: 'team-1',
      period: 'specific_preparatory',
      microcycleType: 'development',
      slots: [createWeeklyTrainingSlot('thursday', 'quality')],
      targetVolumeKm: 10,
      targetElevationGain: 200,
    })

    assert.ok(result.stimulusTemplate.warnings.some((warning) => (
      warning.code === 'no_compatible_template' &&
      warning.facts.some((fact) => fact.code === 'slot_key' && fact.value === 'weekly-thursday') &&
      warning.facts.some((fact) => fact.code === 'role' && fact.value === 'quality')
    )))
  })

  it('preserves negative remaining budget when fixed load exceeds the weekly target', () => {
    const result = explainTemplatesAndLoad({
      templates: [fixedTemplate(16, 900)],
      teamId: 'team-1',
      period: 'specific_preparatory',
      microcycleType: 'development',
      slots: [createWeeklyTrainingSlot('tuesday', 'mountain')],
      targetVolumeKm: 12,
      targetElevationGain: 700,
    })

    assert.ok(result.remainingBudget.decision.some((fact) => (
      fact.code === 'remaining_volume_km' && fact.value === -4
    )))
    assert.ok(result.remainingBudget.decision.some((fact) => (
      fact.code === 'remaining_elevation_gain' && fact.value === -200
    )))
    assert.ok(result.remainingBudget.warnings.some((warning) => (
      warning.code === 'fixed_volume_exceeds_target'
    )))
    assert.ok(result.remainingBudget.warnings.some((warning) => (
      warning.code === 'fixed_elevation_exceeds_target'
    )))
  })

  it('keeps unassigned load visible when there are no flexible slots', () => {
    const slots: WeeklyTrainingSlot[] = [
      {
        ...createWeeklyTrainingSlot('tuesday', 'mountain'),
        preferredWorkoutTypes: ['Trail'],
        preferredTemplateCategories: ['mountain'],
      },
    ]

    const result = explainTemplatesAndLoad({
      templates: [fixedTemplate(8, 300)],
      teamId: 'team-1',
      period: 'specific_preparatory',
      microcycleType: 'development',
      slots,
      targetVolumeKm: 12,
      targetElevationGain: 500,
    })

    assert.ok(result.remainingBudget.decision.some((fact) => (
      fact.code === 'remaining_volume_km' && fact.value === 4
    )))
    assert.ok(result.remainingBudget.decision.some((fact) => (
      fact.code === 'remaining_elevation_gain' && fact.value === 200
    )))
    assert.ok(result.remainingBudget.warnings.some((warning) => (
      warning.code === 'volume_unassigned'
    )))
    assert.ok(result.remainingBudget.warnings.some((warning) => (
      warning.code === 'elevation_unassigned'
    )))
  })
})

function fixedTemplate(distanceKm: number, elevationGain: number): WorkoutTemplate {
  return {
    id: 'mountain-fixed',
    teamId: 'team-1',
    category: 'mountain',
    tags: [],
    archivedAt: null,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
    isDeleted: false,
    sessionDefaults: {
      title: 'Circuito cerro',
      type: 'Trail',
      locationKey: null,
      trackPath: 'track.gpx',
      structure: null,
      notes: null,
    },
    prescriptionDefaults: {
      distanceKm,
      durationMin: null,
      elevationGain,
      intensity: null,
      notes: null,
    },
  }
}
