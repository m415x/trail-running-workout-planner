import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createWorkoutTemplateSnapshot } from '@/lib/workout-templates/workout-template-snapshot'
import type { WorkoutTemplate } from '@/types'

function template(): WorkoutTemplate {
  return {
    id: 'template-1',
    teamId: 'team-1',
    category: 'quality',
    tags: ['fartlek'],
    archivedAt: null,
    sessionDefaults: {
      title: 'Fartlek piramidal',
      type: 'Fartlek',
      locationKey: 'park',
      trackPath: null,
      structure: { mainBlock: '1-2-3-2-1 minutos' },
      notes: 'Controlar la técnica.',
    },
    prescriptionDefaults: {
      distanceKm: 10,
      durationMin: 60,
      elevationGain: 150,
      intensity: { method: 'pam_percentage', pamPercentage: 100 },
      notes: 'Recuperación al trote.',
    },
  }
}

describe('snapshot de plantilla para una sesión', () => {
  it('copia todos los valores reutilizables y conserva la trazabilidad', () => {
    const source = template()
    const snapshot = createWorkoutTemplateSnapshot(source)

    assert.equal(snapshot.sourceTemplateId, source.id)
    assert.deepEqual(snapshot.session, source.sessionDefaults)
    assert.deepEqual(snapshot.prescription, source.prescriptionDefaults)
  })

  it('permanece inmutable frente a cambios posteriores de la plantilla', () => {
    const source = template()
    const snapshot = createWorkoutTemplateSnapshot(source)

    source.sessionDefaults.title = 'Fartlek modificado'
    source.sessionDefaults.structure!.mainBlock = 'Nuevo bloque'
    source.prescriptionDefaults.distanceKm = 14
    if (source.prescriptionDefaults.intensity?.method === 'pam_percentage') {
      source.prescriptionDefaults.intensity.pamPercentage = 110
    }

    assert.equal(snapshot.session.title, 'Fartlek piramidal')
    assert.equal(snapshot.session.structure?.mainBlock, '1-2-3-2-1 minutos')
    assert.equal(snapshot.prescription.distanceKm, 10)
    assert.deepEqual(snapshot.prescription.intensity, { method: 'pam_percentage', pamPercentage: 100 })
  })
})
