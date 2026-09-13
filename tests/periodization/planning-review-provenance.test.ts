import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildIntegralPlanningReviewProvenance } from '@/lib/periodization/planning-review-provenance'
import type { IntegralPlanningReview } from '@/types/training/planning-review.types'

const baseEntity = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function buildReview(): IntegralPlanningReview {
  return {
    scope: {
      teamId: 'team-1',
      groupId: 'group-1',
      groupTrainingPlanId: 'variant-plan-1',
      kind: 'cohort_variant',
      planningCohortId: 'cohort-1',
      sourceGroupTrainingPlanId: 'base-plan-1',
    },
    plan: {
      ...baseEntity,
      id: 'variant-plan-1',
      groupId: 'group-1',
      planningCohortId: 'cohort-1',
      sourceGroupTrainingPlanId: 'base-plan-1',
      title: 'Variante cohorte',
      status: 'active',
    },
    loadStrategy: null,
    intensityStrategy: null,
    macrocycles: [{
      macrocycle: {
        ...baseEntity,
        id: 'macro-1',
        groupTrainingPlanId: 'variant-plan-1',
        title: 'Macro',
        startDate: '2026-01-05',
        endDate: '2026-01-11',
      },
      mesocycles: [{
        mesocycle: {
          ...baseEntity,
          id: 'meso-1',
          macrocycleId: 'macro-1',
          title: 'Base',
          number: 1,
          period: 'general_preparatory',
          objective: 'Construir base',
        },
        microcycles: [{
          microcycle: {
            ...baseEntity,
            id: 'micro-1',
            mesocycleId: 'meso-1',
            weekNumber: 1,
            type: 'development',
            startDate: '2026-01-05',
            endDate: '2026-01-11',
            targetVolumeKm: 42,
            targetVolumeSource: 'manual',
            targetElevationGain: 1_200,
            targetElevationSource: 'generated',
          },
          targets: {
            targetVolumeKm: 42,
            targetVolumeSource: 'manual',
            targetElevationGainM: 1_200,
            targetElevationSource: 'generated',
            targetDurationMin: null,
          },
          intensityTarget: null,
          competitiveAdjustmentValueSources: {
            type: 'generated',
            targetVolumeKm: 'coach',
            targetElevationGainM: 'generated',
            allowIntenseSessions: 'coach',
          },
          sessions: [{
            session: {
              ...baseEntity,
              id: 'session-modified',
              teamId: 'team-1',
              date: '2026-01-06',
              title: 'Calidad',
              type: 'Intervals',
            },
            provenance: {
              ownership: 'generated_modified',
              sharedEventKey: 'variant-plan-1::micro-1::shared-tuesday',
            },
            prescriptions: [{
              prescription: {
                ...baseEntity,
                id: 'prescription-generated',
                sessionId: 'session-modified',
                groupId: 'group-1',
                microcycleId: 'micro-1',
              },
              provenance: {
                ownership: 'generated',
                generationKey: 'variant-plan-1::micro-1::group-1::tuesday',
              },
            }],
          }, {
            session: {
              ...baseEntity,
              id: 'session-manual',
              teamId: 'team-1',
              date: '2026-01-10',
              title: 'Salida grupal',
              type: 'Trail',
            },
            provenance: {
              ownership: 'manual',
              sharedEventKey: null,
            },
            prescriptions: [],
          }],
        }],
      }],
    }],
    competitions: [],
    protectedValues: [{
      entityType: 'session',
      entityId: 'session-modified',
      field: 'structure',
      sourceBoundary: 'session_generation',
      reason: 'El profesor modificó la sesión generada.',
    }, {
      entityType: 'microcycle',
      entityId: 'micro-1',
      field: 'targetVolumeKm',
      sourceBoundary: 'competition_adjustment',
      reason: 'El profesor ajustó el volumen propuesto.',
    }],
    issues: [],
  }
}

describe('provenance integral de planificación', () => {
  it('expone origen de variante y fuentes H7/H10 sin traducirlas', () => {
    const provenance = buildIntegralPlanningReviewProvenance(buildReview())

    assert.deepEqual(provenance.plan, {
      teamId: 'team-1',
      groupId: 'group-1',
      groupTrainingPlanId: 'variant-plan-1',
      kind: 'cohort_variant',
      planningCohortId: 'cohort-1',
      sourceGroupTrainingPlanId: 'base-plan-1',
    })
    assert.deepEqual(provenance.microcycles[0].targetSources, {
      targetVolumeSource: 'manual',
      targetElevationSource: 'generated',
    })
    assert.deepEqual(provenance.microcycles[0].competitiveAdjustmentValueSources, {
      type: 'generated',
      targetVolumeKm: 'coach',
      targetElevationGainM: 'generated',
      allowIntenseSessions: 'coach',
    })
    assert.equal(provenance.microcycles[0].protectedValues.length, 1)
  })

  it('deriva reemplazabilidad con la regla H6 y conserva claves de generación', () => {
    const provenance = buildIntegralPlanningReviewProvenance(buildReview())
    const manual = provenance.sessions.find(({ sessionId }) => sessionId === 'session-manual')
    const modified = provenance.sessions.find(({ sessionId }) => (
      sessionId === 'session-modified'
    ))
    const prescription = modified?.prescriptions[0]

    assert.equal(manual?.provenance.ownership, 'manual')
    assert.equal(manual?.replaceableByRegeneration, false)
    assert.equal(modified?.provenance.ownership, 'generated_modified')
    assert.equal(modified?.replaceableByRegeneration, false)
    assert.equal(prescription?.provenance.ownership, 'generated')
    assert.equal(prescription?.replaceableByRegeneration, true)
    assert.equal(
      prescription?.provenance.generationKey,
      'variant-plan-1::micro-1::group-1::tuesday',
    )
  })

  it('ordena la proyección sin mutar las anotaciones protegidas', () => {
    const review = buildReview()
    const original = [...review.protectedValues]
    const provenance = buildIntegralPlanningReviewProvenance(review)

    assert.deepEqual(
      provenance.protectedValues.map(({ entityType }) => entityType),
      ['microcycle', 'session'],
    )
    assert.deepEqual(review.protectedValues, original)
  })
})
