import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateIntegralPlanningReview } from '@/lib/periodization/planning-review-validator'
import type { IntegralPlanningReview } from '@/types/training/planning-review.types'

const baseEntity = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function buildReview(competitionDate = '2026-01-10'): IntegralPlanningReview {
  return {
    scope: {
      teamId: 'team-1',
      groupId: 'group-1',
      groupTrainingPlanId: 'plan-1',
      kind: 'group_base',
      planningCohortId: null,
      sourceGroupTrainingPlanId: null,
    },
    plan: {
      ...baseEntity,
      id: 'plan-1',
      groupId: 'group-1',
      planningCohortId: null,
      sourceGroupTrainingPlanId: null,
      title: 'Plan base',
      status: 'active',
    },
    loadStrategy: null,
    intensityStrategy: null,
    macrocycles: [{
      macrocycle: {
        ...baseEntity,
        id: 'macro-1',
        groupTrainingPlanId: 'plan-1',
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
            targetVolumeKm: 40,
            targetVolumeSource: 'generated',
            targetElevationGain: 1_000,
            targetElevationSource: 'manual',
          },
          targets: {
            targetVolumeKm: 40,
            targetVolumeSource: 'generated',
            targetElevationGainM: 1_000,
            targetElevationSource: 'manual',
            targetDurationMin: null,
          },
          intensityTarget: null,
          competitiveAdjustmentValueSources: null,
          sessions: [{
            session: {
              ...baseEntity,
              id: 'session-1',
              teamId: 'team-1',
              date: '2026-01-07',
              title: 'Montaña',
              type: 'Trail',
            },
            provenance: {
              ownership: 'generated',
              sharedEventKey: 'plan-1::micro-1::shared-wednesday',
            },
            prescriptions: [{
              prescription: {
                ...baseEntity,
                id: 'prescription-1',
                sessionId: 'session-1',
                groupId: 'group-1',
                microcycleId: 'micro-1',
              },
              provenance: {
                ownership: 'generated',
                generationKey: 'plan-1::micro-1::group-1::wednesday',
              },
            }],
          }],
        }],
      }],
    }],
    competitions: [{
      entry: {
        ...baseEntity,
        id: 'competition-1',
        groupTrainingPlanId: 'plan-1',
        name: 'Trail A',
        date: competitionDate,
        distanceKm: 21,
        elevationGainM: 900,
        priority: 'A',
        status: 'confirmed',
      },
      impactWindow: null,
    }],
    protectedValues: [{
      entityType: 'session',
      entityId: 'session-1',
      field: 'structure',
      sourceBoundary: 'session_generation',
      reason: 'Sesión editada por el profesor.',
    }],
    issues: [],
  }
}

describe('validador integral de planificación', () => {
  it('acepta un agregado base coherente sin mutarlo', () => {
    const review = buildReview()
    const snapshot = structuredClone(review)

    const validation = validateIntegralPlanningReview(review)

    assert.equal(validation.isValid, true)
    assert.deepEqual(validation.issues, [])
    assert.deepEqual(review, snapshot)
  })

  it('expone conflictos explicables de varios boundaries en una sola pasada', () => {
    const review = buildReview()
    const macrocycle = review.macrocycles[0]
    const microcycle = macrocycle.mesocycles[0].microcycles[0]
    const session = microcycle.sessions[0]
    const competition = review.competitions[0]

    Object.assign(review.scope, { groupId: 'group-other' })
    Object.assign(microcycle.microcycle, {
      mesocycleId: 'meso-other',
      targetVolumeKm: 35,
    })
    Object.assign(microcycle.targets, { targetElevationGainM: -1 })
    Object.assign(session.session, {
      teamId: 'team-other',
      date: '2026-02-01',
    })
    Object.assign(session.prescriptions[0].prescription, { groupId: 'group-other' })
    Object.assign(competition.entry, {
      groupTrainingPlanId: 'plan-other',
      date: '2026-02-01',
    })
    review.protectedValues.push({
      entityType: 'session',
      entityId: 'session-missing',
      field: 'title',
      sourceBoundary: 'session_generation',
      reason: 'Referencia ausente.',
    })

    const validation = validateIntegralPlanningReview(review)
    const codes = new Set(validation.issues.map(({ code }) => code))

    assert.equal(validation.isValid, false)
    assert.equal(codes.has('scope_group_id_mismatch'), true)
    assert.equal(codes.has('hierarchy_parent_mismatch'), true)
    assert.equal(codes.has('invalid_target_value'), true)
    assert.equal(codes.has('microcycle_target_projection_mismatch'), true)
    assert.equal(codes.has('session_team_mismatch'), true)
    assert.equal(codes.has('session_outside_microcycle'), true)
    assert.equal(codes.has('prescription_reference_mismatch'), true)
    assert.equal(codes.has('competition_plan_mismatch'), true)
    assert.equal(codes.has('competition_outside_planning_horizon'), true)
    assert.equal(codes.has('protected_value_reference_missing'), true)
    assert.equal(
      validation.issues.every(({ message, references }) => (
        message.length > 0 && references.length > 0
      )),
      true,
    )
  })

  it('mantiene advertencias revisables sin bloquear persistencia', () => {
    const validation = validateIntegralPlanningReview(buildReview('2026-02-01'))

    assert.equal(validation.isValid, true)
    assert.deepEqual(
      validation.issues.map(({ code, severity }) => ({ code, severity })),
      [{
        code: 'competition_outside_planning_horizon',
        severity: 'warning',
      }],
    )
  })

  it('rechaza provenance generada sin clave estable', () => {
    const review = buildReview()
    const session = review.macrocycles[0].mesocycles[0].microcycles[0].sessions[0]
    Object.assign(session.provenance, { sharedEventKey: '   ' })

    const validation = validateIntegralPlanningReview(review)

    assert.equal(validation.isValid, false)
    assert.equal(
      validation.issues.some(({ code }) => code === 'invalid_generation_provenance'),
      true,
    )
  })
})
