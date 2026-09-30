import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { explainTemplatesAndLoad } from '@/lib/session-generation/generation-explanation'
import { createWeeklyTrainingSlot } from '@/lib/session-generation/default-weekly-pattern'
import type { WorkoutTemplate } from '@/types/training/workout-template.types'

const slots = [
  createWeeklyTrainingSlot('tuesday', 'mountain'),
  createWeeklyTrainingSlot('thursday', 'quality'),
  createWeeklyTrainingSlot('saturday', 'long'),
]

const templates: WorkoutTemplate[] = [
  template({
    id: 'mountain-fixed',
    title: 'Circuito cerro',
    category: 'mountain',
    type: 'Trail',
    trackPath: 'track.gpx',
    distanceKm: 16,
    elevationGain: 900,
  }),
  template({
    id: 'quality-flex',
    title: 'Intervalos',
    category: 'quality',
    type: 'Intervals',
  }),
  template({
    id: 'long-flex',
    title: 'Fondo',
    category: 'endurance',
    type: 'Long',
  }),
]

describe('GenerationExplanation templates and load evidence', () => {
  it('explains the selected template through material compatibility factors without exposing scores', () => {
    const result = explainTemplatesAndLoad({
      templates,
      teamId: 'team-1',
      period: 'specific_preparatory',
      microcycleType: 'development',
      slots,
      targetVolumeKm: 50,
      targetElevationGain: 1400,
    })

    assert.ok(result.stimulusTemplate.decision.some((fact) => (
      fact.code === 'selected_template' &&
      fact.value === 'weekly-tuesday::mountain-fixed'
    )))
    assert.ok(result.stimulusTemplate.consequence.some((fact) => (
      fact.code === 'template_material_factors' &&
      fact.value === 'weekly-tuesday::role,period,microcycle'
    )))
    assert.equal(
      result.stimulusTemplate.decision.some((fact) => fact.code.includes('score')),
      false,
    )
    assert.equal(
      result.stimulusTemplate.consequence.some((fact) => fact.code.includes('candidate')),
      false,
    )
  })

  it('explains fixed circuit consumption and the remaining weekly budget', () => {
    const result = explainTemplatesAndLoad({
      templates,
      teamId: 'team-1',
      period: 'specific_preparatory',
      microcycleType: 'development',
      slots,
      targetVolumeKm: 50,
      targetElevationGain: 1400,
    })

    assert.ok(result.fixedLoad.decision.some((fact) => (
      fact.code === 'fixed_slot_load' &&
      fact.value === 'weekly-tuesday::16::900'
    )))
    assert.ok(result.remainingBudget.inputs.some((fact) => (
      fact.code === 'target_volume_km' && fact.value === 50
    )))
    assert.ok(result.remainingBudget.inputs.some((fact) => (
      fact.code === 'target_elevation_gain' && fact.value === 1400
    )))
    assert.ok(result.remainingBudget.decision.some((fact) => (
      fact.code === 'remaining_volume_km' && fact.value === 34
    )))
    assert.ok(result.remainingBudget.decision.some((fact) => (
      fact.code === 'remaining_elevation_gain' && fact.value === 500
    )))
  })

  it('explains flexible distance and elevation allocations independently from the fixed circuit', () => {
    const result = explainTemplatesAndLoad({
      templates,
      teamId: 'team-1',
      period: 'specific_preparatory',
      microcycleType: 'development',
      slots,
      targetVolumeKm: 50,
      targetElevationGain: 1400,
    })

    assert.ok(result.flexibleAllocation.decision.some((fact) => (
      fact.code === 'flexible_volume_allocation' &&
      fact.value.startsWith('weekly-thursday::')
    )))
    assert.ok(result.flexibleAllocation.decision.some((fact) => (
      fact.code === 'flexible_elevation_allocation' &&
      fact.value.startsWith('weekly-thursday::')
    )))
    assert.ok(result.flexibleAllocation.consequence.some((fact) => (
      fact.code === 'allocated_volume_km' && fact.value === 50
    )))
    assert.ok(result.flexibleAllocation.consequence.some((fact) => (
      fact.code === 'allocated_elevation_gain' && fact.value === 1400
    )))
  })
})

function template(input: {
  id: string
  title: string
  category: WorkoutTemplate['category']
  type: WorkoutTemplate['sessionDefaults']['type']
  trackPath?: string
  distanceKm?: number
  elevationGain?: number
}): WorkoutTemplate {
  return {
    id: input.id,
    teamId: 'team-1',
    category: input.category,
    tags: [],
    archivedAt: null,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
    isDeleted: false,
    sessionDefaults: {
      title: input.title,
      type: input.type,
      locationKey: null,
      trackPath: input.trackPath ?? null,
      structure: null,
      notes: null,
    },
    prescriptionDefaults: {
      distanceKm: input.distanceKm ?? null,
      durationMin: null,
      elevationGain: input.elevationGain ?? null,
      intensity: null,
      notes: null,
    },
  }
}
