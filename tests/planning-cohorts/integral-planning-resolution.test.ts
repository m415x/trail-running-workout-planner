import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolveAthleteIntegralPlanningOnDate } from '@/lib/planning-cohorts/integral-planning-resolution'
import type { PlanningResolutionPlan } from '@/lib/planning-cohorts/planning-resolution'
import type { IntegralPlanningReview } from '@/types/training/planning-review.types'

const entityDates = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function resolutionPlan(
  id: string,
  planningCohortId: string | null,
): PlanningResolutionPlan {
  return {
    id,
    groupId: 'group-1',
    planningCohortId,
    status: 'active',
    isDeleted: false,
    macrocycles: [{
      startDate: '2026-01-05',
      endDate: '2026-01-11',
      isDeleted: false,
    }],
  }
}

function review(
  planId: string,
  planningCohortId: string | null,
  marker: string,
): IntegralPlanningReview {
  const variant = planningCohortId !== null
  return {
    scope: {
      teamId: 'team-1',
      groupId: 'group-1',
      groupTrainingPlanId: planId,
      kind: variant ? 'cohort_variant' : 'group_base',
      planningCohortId,
      sourceGroupTrainingPlanId: variant ? 'base-plan' : null,
    },
    plan: {
      ...entityDates,
      id: planId,
      groupId: 'group-1',
      planningCohortId,
      sourceGroupTrainingPlanId: variant ? 'base-plan' : null,
      title: marker,
      status: 'active',
    },
    loadStrategy: null,
    intensityStrategy: null,
    macrocycles: [{
      macrocycle: {
        ...entityDates,
        id: `macro-${marker}`,
        groupTrainingPlanId: planId,
        title: marker,
        startDate: '2026-01-05',
        endDate: '2026-01-11',
      },
      mesocycles: [{
        mesocycle: {
          ...entityDates,
          id: `meso-${marker}`,
          macrocycleId: `macro-${marker}`,
          title: marker,
          number: 1,
          period: 'general_preparatory',
          objective: marker,
        },
        microcycles: [{
          microcycle: {
            ...entityDates,
            id: `micro-${marker}`,
            mesocycleId: `meso-${marker}`,
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
              ...entityDates,
              id: `session-${marker}`,
              teamId: 'team-1',
              date: '2026-01-07',
              title: marker,
              type: 'Trail',
            },
            provenance: {
              ownership: 'generated',
              sharedEventKey: `${planId}::micro-${marker}::shared`,
            },
            prescriptions: [{
              prescription: {
                ...entityDates,
                id: `prescription-${marker}`,
                sessionId: `session-${marker}`,
                groupId: 'group-1',
                microcycleId: `micro-${marker}`,
              },
              provenance: {
                ownership: 'generated',
                generationKey: `${planId}::micro-${marker}::group-1`,
              },
            }],
          }],
        }],
      }],
    }],
    competitions: [{
      entry: {
        ...entityDates,
        id: `competition-${marker}`,
        groupTrainingPlanId: planId,
        name: marker,
        date: '2026-01-10',
        distanceKm: 21,
        elevationGainM: 900,
        priority: 'A',
        status: 'confirmed',
      },
      impactWindow: null,
    }],
    protectedValues: [],
    issues: [],
  }
}

const basePlan = resolutionPlan('base-plan', null)
const variantPlan = resolutionPlan('variant-plan', 'cohort-1')
const baseReview = review('base-plan', null, 'base')
const variantReview = review('variant-plan', 'cohort-1', 'variant')

function planningInput(withMembership: boolean) {
  return {
    athleteTeamId: 'team-1',
    currentGroupId: 'group-1',
    groupChanges: [],
    memberships: withMembership ? [{
      id: 'membership-1',
      startDate: '2026-01-01',
      endDate: null,
      isDeleted: false,
      cohort: {
        id: 'cohort-1',
        teamId: 'team-1',
        groupId: 'group-1',
        status: 'active' as const,
        isDeleted: false,
        planningVariant: variantPlan,
      },
    }] : [],
    basePlans: [basePlan],
    date: '2026-01-07',
  }
}

describe('resolución integral atleta cohorte -> grupo', () => {
  it('usa exclusivamente el agregado variante cuando la cohorte aplica', () => {
    const result = resolveAthleteIntegralPlanningOnDate({
      planning: planningInput(true),
      reviews: [baseReview, variantReview],
    })

    assert.equal(result.status, 'resolved')
    if (result.status !== 'resolved') return
    assert.equal(result.source, 'cohort')
    assert.equal(result.planId, 'variant-plan')
    assert.equal(result.review.plan.title, 'variant')
    assert.equal(result.summary.scope.groupTrainingPlanId, 'variant-plan')
    assert.deepEqual(
      result.summary.competitions.map(({ entry }) => entry.name),
      ['variant'],
    )
    assert.equal(result.summary.totals.sessionCount, 1)
    assert.equal(result.summary.totals.prescriptionCount, 1)
  })

  it('cae al agregado base cuando no hay cohorte aplicable', () => {
    const result = resolveAthleteIntegralPlanningOnDate({
      planning: planningInput(false),
      reviews: [variantReview, baseReview],
    })

    assert.equal(result.status, 'resolved')
    if (result.status !== 'resolved') return
    assert.equal(result.source, 'group')
    assert.equal(result.planId, 'base-plan')
    assert.equal(result.review.plan.title, 'base')
    assert.deepEqual(
      result.summary.competitions.map(({ entry }) => entry.name),
      ['base'],
    )
  })

  it('bloquea un agregado resuelto que mezcla referencias de otro plan', () => {
    const mixedVariant = structuredClone(variantReview)
    mixedVariant.competitions[0].entry.groupTrainingPlanId = 'base-plan'

    const result = resolveAthleteIntegralPlanningOnDate({
      planning: planningInput(true),
      reviews: [baseReview, mixedVariant],
    })

    assert.equal(result.status, 'conflict')
    if (result.status !== 'conflict') return
    assert.equal(result.reason, 'resolved-review-integrity')
    assert.equal(
      result.issues?.some(({ code }) => code === 'competition_plan_mismatch'),
      true,
    )
  })

  it('propaga ambigüedades H7 sin elegir una revisión', () => {
    const overlapping = planningInput(true)
    overlapping.memberships.push({
      ...overlapping.memberships[0],
      id: 'membership-2',
    })

    const result = resolveAthleteIntegralPlanningOnDate({
      planning: overlapping,
      reviews: [baseReview, variantReview],
    })

    assert.deepEqual(result, {
      status: 'conflict',
      reason: 'overlapping-cohorts',
      groupId: 'group-1',
      conflictingIds: ['membership-1', 'membership-2'],
    })
  })
})
