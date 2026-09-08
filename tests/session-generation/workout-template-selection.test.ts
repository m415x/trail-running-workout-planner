import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createWeeklyTrainingSlot } from '@/lib/session-generation/default-weekly-pattern'
import { selectWorkoutTemplate } from '@/lib/session-generation/workout-template-selection'
import type {
  WorkoutTemplate,
  WorkoutTemplateCategory,
} from '@/types/training/workout-template.types'
import type { WorkoutType } from '@/types/training/workout.types'

describe('selección de plantillas para generación semanal', () => {
  it('prefiere coincidencias de categoría y tipo para el rol planificado', () => {
    const result = selectWorkoutTemplate({
      templates: [
        template('trail', 'Salida trail', 'mountain', 'Trail'),
        template('hills', 'Cuestas', 'quality', 'Hills'),
        template('base', 'Rodaje', 'endurance', 'Base'),
      ],
      teamId: 'team-1',
      period: 'specific_preparatory',
      microcycleType: 'development',
      slot: createWeeklyTrainingSlot('tuesday', 'mountain'),
    })

    assert.equal(result.selected?.id, 'trail')
    assert.deepEqual(result.candidates.map(({ template: candidate }) => candidate.id), [
      'trail',
      'hills',
    ])
    assert.deepEqual(result.warnings, [])
  })

  it('excluye plantillas archivadas, eliminadas o pertenecientes a otro equipo', () => {
    const active = template('active', 'Activa', 'quality', 'Intervals')
    const archived = { ...template('archived', 'Archivada', 'quality', 'Intervals'), archivedAt: '2026-09-01' }
    const deleted = { ...template('deleted', 'Eliminada', 'quality', 'Intervals'), isDeleted: true }
    const foreign = { ...template('foreign', 'Ajena', 'quality', 'Intervals'), teamId: 'team-2' }

    const result = selectWorkoutTemplate({
      templates: [archived, deleted, foreign, active],
      teamId: 'team-1',
      period: 'general_preparatory',
      microcycleType: 'development',
      slot: createWeeklyTrainingSlot('thursday', 'quality'),
    })

    assert.deepEqual(result.candidates.map(({ template: candidate }) => candidate.id), ['active'])
  })

  it('restringe descarga, taper y transición sin anular la calidad permitida en taper', () => {
    const templates = [
      template('base', 'Base', 'endurance', 'Base'),
      template('quality', 'Calidad', 'quality', 'Intervals'),
      template('mountain', 'Montaña', 'mountain', 'Hills'),
    ]

    const deload = selectWorkoutTemplate({
      templates,
      teamId: 'team-1',
      period: 'general_preparatory',
      microcycleType: 'deload',
      slot: createWeeklyTrainingSlot('thursday', 'quality'),
    })
    const taper = selectWorkoutTemplate({
      templates,
      teamId: 'team-1',
      period: 'competitive',
      microcycleType: 'tapering',
      slot: createWeeklyTrainingSlot('thursday', 'quality'),
    })
    const transition = selectWorkoutTemplate({
      templates,
      teamId: 'team-1',
      period: 'transition',
      microcycleType: 'base',
      slot: createWeeklyTrainingSlot('thursday', 'quality'),
    })

    assert.equal(deload.selected, null)
    assert.equal(taper.selected?.id, 'quality')
    assert.equal(transition.selected, null)
  })

  it('usa una plantilla de competencia exclusivamente para el slot de carrera', () => {
    const race = template('race', 'Carrera objetivo', 'competition', 'Race')

    const competition = selectWorkoutTemplate({
      templates: [race],
      teamId: 'team-1',
      period: 'competitive',
      microcycleType: 'race',
      slot: createWeeklyTrainingSlot('sunday', 'competition'),
    })
    const regular = selectWorkoutTemplate({
      templates: [race],
      teamId: 'team-1',
      period: 'competitive',
      microcycleType: 'race',
      slot: createWeeklyTrainingSlot('thursday', 'quality'),
    })
    const outsideCompetitivePeriod = selectWorkoutTemplate({
      templates: [race],
      teamId: 'team-1',
      period: 'specific_preparatory',
      microcycleType: 'race',
      slot: createWeeklyTrainingSlot('sunday', 'competition'),
    })

    assert.equal(competition.selected?.id, 'race')
    assert.equal(regular.selected, null)
    assert.equal(outsideCompetitivePeriod.selected, null)
  })

  it('usa el período para desempatar plantillas compatibles con el mismo rol', () => {
    const endurance = template('endurance', 'Trail aeróbico', 'endurance', 'Trail')
    const mountain = template('mountain', 'Trail específico', 'mountain', 'Trail')
    const slot = createWeeklyTrainingSlot('saturday', 'long')

    const general = selectWorkoutTemplate({
      templates: [mountain, endurance],
      teamId: 'team-1',
      period: 'general_preparatory',
      microcycleType: 'development',
      slot,
    })
    const specific = selectWorkoutTemplate({
      templates: [endurance, mountain],
      teamId: 'team-1',
      period: 'specific_preparatory',
      microcycleType: 'development',
      slot,
    })

    assert.equal(general.selected?.id, 'endurance')
    assert.equal(specific.selected?.id, 'mountain')
  })

  it('usa etiquetas solo para ordenar candidatos compatibles', () => {
    const ordinary = template('ordinary', 'Fartlek A', 'quality', 'Fartlek')
    const tagged = {
      ...template('tagged', 'Fartlek Z', 'quality', 'Fartlek'),
      tags: ['quality', 'specific_preparatory', 'development'],
    }
    const incompatibleTagged = {
      ...template('recovery', 'Recuperación', 'recovery', 'Base'),
      tags: ['quality', 'specific_preparatory', 'development'],
    }

    const result = selectWorkoutTemplate({
      templates: [ordinary, incompatibleTagged, tagged],
      teamId: 'team-1',
      period: 'specific_preparatory',
      microcycleType: 'development',
      slot: createWeeklyTrainingSlot('thursday', 'quality'),
    })

    assert.equal(result.selected?.id, 'tagged')
    assert.equal(result.candidates.some(({ template: candidate }) => candidate.id === 'recovery'), false)
  })

  it('no usa los valores de carga o intensidad de la plantilla para decidir compatibilidad', () => {
    const first = template('a', 'Mismo título', 'quality', 'PAM')
    const second = {
      ...template('b', 'Mismo título', 'quality', 'PAM'),
      prescriptionDefaults: {
        distanceKm: 99,
        durationMin: 300,
        elevationGain: 5000,
        intensity: { method: 'pam_percentage' as const, pamPercentage: 200 as const },
        notes: null,
      },
    }

    const result = selectWorkoutTemplate({
      templates: [second, first],
      teamId: 'team-1',
      period: 'specific_preparatory',
      microcycleType: 'shock',
      slot: createWeeklyTrainingSlot('thursday', 'quality'),
    })

    assert.equal(result.selected?.id, 'a')
  })

  it('devuelve una advertencia explícita cuando no existe una opción compatible', () => {
    const result = selectWorkoutTemplate({
      templates: [],
      teamId: 'team-1',
      period: 'transition',
      microcycleType: 'deload',
      slot: createWeeklyTrainingSlot('monday', 'recovery'),
    })

    assert.equal(result.selected, null)
    assert.equal(result.candidates.length, 0)
    assert.equal(result.warnings.length, 1)
  })
})

function template(
  id: string,
  title: string,
  category: WorkoutTemplateCategory,
  type: WorkoutType,
): WorkoutTemplate {
  return {
    id,
    teamId: 'team-1',
    category,
    tags: [],
    archivedAt: null,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
    isDeleted: false,
    sessionDefaults: {
      title,
      type,
      locationKey: null,
      trackPath: null,
      structure: null,
      notes: null,
    },
    prescriptionDefaults: {
      distanceKm: null,
      durationMin: null,
      elevationGain: null,
      intensity: null,
      notes: null,
    },
  }
}
