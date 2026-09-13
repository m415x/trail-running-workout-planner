import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildIntegralPlanningDiff } from '@/lib/periodization/planning-review-diff'
import { reconcileAcceptedPlanningBlocks } from '@/lib/periodization/planning-review-reconciliation'
import { validateIntegralPlanningReview } from '@/lib/periodization/planning-review-validator'
import type { IntegralPlanningReview, PlanningReviewScope } from '@/types/training/planning-review.types'

const baseEntity = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function buildReview(): IntegralPlanningReview {
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
            targetElevationSource: 'generated',
          },
          targets: {
            targetVolumeKm: 40,
            targetVolumeSource: 'generated',
            targetElevationGainM: 1_000,
            targetElevationSource: 'generated',
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
    competitions: [],
    protectedValues: [],
    issues: [],
  }
}

function microcycle(review: IntegralPlanningReview) {
  return review.macrocycles[0].mesocycles[0].microcycles[0]
}

function issueCodes(review: IntegralPlanningReview) {
  return validateIntegralPlanningReview(review).issues.map(({ code }) => code)
}

const coach = {
  source: 'coach' as const,
  coachId: 'coach-1',
  decidedAt: '2026-09-12T21:20:00.000-03:00',
  reason: 'Aislamiento revisado',
}

describe('aislamiento integral team/group/cohort/plan', () => {
  it('detecta referencias cruzadas de team, group y plan antes de persistir', () => {
    const review = buildReview()
    const week = microcycle(review)

    Object.assign(review.macrocycles[0].macrocycle, { groupTrainingPlanId: 'plan-2' })
    Object.assign(week.sessions[0].session, { teamId: 'team-2' })
    Object.assign(week.sessions[0].prescriptions[0].prescription, { groupId: 'group-2' })

    const validation = validateIntegralPlanningReview(review)
    const codes = validation.issues.map(({ code }) => code)

    assert.equal(validation.isValid, false)
    assert.ok(codes.includes('hierarchy_parent_mismatch'))
    assert.ok(codes.includes('session_team_mismatch'))
    assert.ok(codes.includes('prescription_reference_mismatch'))
  })

  it('detecta scope de grupo, plan y cohorte que no coincide con el plan revisado', () => {
    const groupMismatch = buildReview()
    Object.assign(groupMismatch.scope, { groupId: 'group-2' })
    assert.ok(issueCodes(groupMismatch).includes('scope_group_id_mismatch'))

    const planMismatch = buildReview()
    Object.assign(planMismatch.scope, { groupTrainingPlanId: 'plan-2' })
    assert.ok(issueCodes(planMismatch).includes('scope_plan_id_mismatch'))

    const cohortMismatch = buildReview()
    Object.assign(cohortMismatch.scope, {
      kind: 'cohort_variant',
      planningCohortId: 'cohort-2',
      sourceGroupTrainingPlanId: 'plan-base-2',
    })
    const cohortCodes = issueCodes(cohortMismatch)
    assert.ok(cohortCodes.includes('scope_plan_kind_mismatch'))
    assert.ok(cohortCodes.includes('scope_cohort_lineage_mismatch'))
  })

  it('propaga conflictos de aislamiento al diff integral', () => {
    const current = buildReview()
    const proposed = structuredClone(current)
    Object.assign(proposed.scope, { teamId: 'team-2' })
    Object.assign(microcycle(proposed).sessions[0].session, { teamId: 'team-2' })

    const diff = buildIntegralPlanningDiff(current, proposed)

    assert.equal(diff.hasConflicts, true)
    assert.ok(diff.issues.some(({ code }) => code === 'session_team_mismatch'))
  })

  it('rechaza reconciliación cuando cambia cualquier dimensión del scope', () => {
    const mutations: Array<Partial<PlanningReviewScope>> = [
      { teamId: 'team-2' },
      { groupId: 'group-2' },
      { groupTrainingPlanId: 'plan-2' },
      {
        kind: 'cohort_variant',
        planningCohortId: 'cohort-2',
        sourceGroupTrainingPlanId: 'plan-base-2',
      },
    ]

    for (const mutation of mutations) {
      const current = buildReview()
      const proposed = structuredClone(current)
      Object.assign(proposed.scope, mutation)

      assert.throws(
        () => reconcileAcceptedPlanningBlocks({ current, proposed, decisions: [] }),
        /same group\/cohort scope/,
      )
    }
  })

  it('adjunta el scope exacto a cada operación aceptada', () => {
    const current = buildReview()
    const proposed = structuredClone(current)
    Object.assign(microcycle(proposed).microcycle, { targetVolumeKm: 42 })
    Object.assign(microcycle(proposed).targets, { targetVolumeKm: 42 })

    const reconciliation = reconcileAcceptedPlanningBlocks({
      current,
      proposed,
      decisions: [{
        blockId: 'macrocycle:macrocycle:generation:plan-1:ordinal:1',
        decision: 'accept',
        provenance: coach,
      }],
    })

    assert.ok(reconciliation.operations.length > 0)
    assert.equal(
      reconciliation.operations.every(({ scope }) => (
        JSON.stringify(scope) === JSON.stringify(reconciliation.scope)
      )),
      true,
    )
  })
})
