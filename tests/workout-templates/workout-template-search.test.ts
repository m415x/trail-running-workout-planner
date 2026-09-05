import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  matchesWorkoutTemplateSearch,
  normalizeWorkoutTemplateTags,
} from '@/lib/workout-templates/workout-template-search'

import type { WorkoutTemplate } from '@/types'

const template: WorkoutTemplate = {
  id: 'template-1',
  teamId: 'team-1',
  category: 'mountain',
  tags: ['Cuestas', 'Técnica de subida'],
  archivedAt: null,
  sessionDefaults: {
    title: 'Cuestas cortas',
    type: 'Hills',
    locationKey: null,
    trackPath: null,
    structure: {
      warmup: 'Movilidad dinámica',
      mainBlock: 'Ocho repeticiones en subida',
    },
    notes: null,
  },
  prescriptionDefaults: {
    distanceKm: 8,
    durationMin: 60,
    elevationGain: 450,
    intensity: { method: 'pam_percentage', pamPercentage: 100 },
    notes: 'Recuperación bajando.',
  },
}

describe('búsqueda de plantillas', () => {
  it('normaliza espacios, duplicados, mayúsculas y límites de etiquetas', () => {
    assert.deepEqual(
      normalizeWorkoutTemplateTags([' Cuestas ', 'cuestas', 'Técnica   de subida', '']),
      ['Cuestas', 'Técnica de subida'],
    )
  })

  it('busca sin distinguir mayúsculas ni acentos en contenido y etiquetas', () => {
    assert.equal(matchesWorkoutTemplateSearch(template, { query: 'tecnica subida' }), true)
    assert.equal(matchesWorkoutTemplateSearch(template, { tags: ['técnica de subida'] }), true)
    assert.equal(matchesWorkoutTemplateSearch(template, { query: 'velocidad' }), false)
  })

  it('combina filtros con OR interno y AND entre criterios', () => {
    assert.equal(matchesWorkoutTemplateSearch(template, {
      categories: ['quality', 'mountain'],
      workoutTypes: ['Hills'],
      tags: ['potencia', 'cuestas'],
    }), true)
    assert.equal(matchesWorkoutTemplateSearch(template, {
      categories: ['mountain'],
      workoutTypes: ['Long'],
    }), false)
  })

  it('oculta archivadas por defecto y permite buscarlas explícitamente', () => {
    const archived = { ...template, archivedAt: '2026-09-05T12:00:00.000Z' }

    assert.equal(matchesWorkoutTemplateSearch(archived, {}), false)
    assert.equal(matchesWorkoutTemplateSearch(archived, { archive: 'archived' }), true)
    assert.equal(matchesWorkoutTemplateSearch(archived, { archive: 'all' }), true)
    assert.equal(matchesWorkoutTemplateSearch(template, { archive: 'archived' }), false)
  })
})
