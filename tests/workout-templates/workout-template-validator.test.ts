import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateWorkoutTemplateDefaults } from '@/lib/workout-templates/workout-template-validator'

import type { WorkoutTemplateDraft } from '@/types'

function templateFixture(
  overrides: Partial<WorkoutTemplateDraft> = {},
): WorkoutTemplateDraft {
  return {
    teamId: 'team_1',
    sessionDefaults: {
      title: 'Cuestas cortas',
      type: 'Hills',
      locationKey: null,
      trackPath: null,
      structure: {
        preliminaryExercises: 'Movilidad y técnica',
        warmup: '15 minutos suaves',
        mainBlock: '8 × 45 segundos en subida',
        cooldown: '10 minutos suaves',
      },
      notes: null,
    },
    prescriptionDefaults: {
      distanceKm: 8,
      durationMin: 60,
      elevationGain: 450,
      intensity: { method: 'pam_percentage', pamPercentage: 100 },
      notes: 'Recuperar bajando al trote.',
    },
    ...overrides,
  }
}

describe('valores predeterminados de plantillas', () => {
  it('acepta una estructura completa con volumen e intensidad', () => {
    const result = validateWorkoutTemplateDefaults(templateFixture())

    assert.equal(result.isValid, true)
    assert.deepEqual(result.errors, [])
  })

  it('acepta plantillas de instrucciones sin carga ni intensidad', () => {
    const template = templateFixture({
      prescriptionDefaults: {
        distanceKm: null,
        durationMin: null,
        elevationGain: null,
        intensity: null,
        notes: null,
      },
    })

    assert.equal(validateWorkoutTemplateDefaults(template).isValid, true)
  })

  it('distingue valores ausentes de ceros deliberados', () => {
    const template = templateFixture({
      prescriptionDefaults: {
        distanceKm: 0,
        durationMin: 0,
        elevationGain: 0,
        intensity: { method: 'hr_zone', zone: 'Z1' },
        notes: null,
      },
    })

    assert.equal(validateWorkoutTemplateDefaults(template).isValid, true)
  })

  it('rechaza unidades negativas, enteros inválidos y PAM fuera de rango', () => {
    const template = templateFixture({
      prescriptionDefaults: {
        distanceKm: -1,
        durationMin: 30.5,
        elevationGain: 450.5,
        intensity: { method: 'pam_percentage', pamPercentage: 250 },
        notes: null,
      },
    })
    const result = validateWorkoutTemplateDefaults(template)

    assert.equal(result.isValid, false)
    assert.deepEqual(
      result.errors.map((error) => error.field),
      ['distanceKm', 'durationMin', 'elevationGain', 'intensity'],
    )
  })

  it('rechaza equipo, título, tipo, zona y bloques estructurales inválidos', () => {
    const template = templateFixture({
      teamId: ' ',
      sessionDefaults: {
        title: ' ',
        type: 'Invalid' as 'Base',
        locationKey: null,
        trackPath: null,
        structure: { warmup: '   ' },
        notes: null,
      },
      prescriptionDefaults: {
        intensity: { method: 'hr_zone', zone: 'Z9' as 'Z1' },
        notes: null,
      },
    })
    const result = validateWorkoutTemplateDefaults(template)

    assert.equal(result.isValid, false)
    assert.deepEqual(
      result.errors.map((error) => error.field),
      ['teamId', 'title', 'type', 'structure', 'intensity'],
    )
  })
})
