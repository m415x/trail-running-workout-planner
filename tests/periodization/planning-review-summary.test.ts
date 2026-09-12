import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildIntegralPlanningReviewSummary } from '@/lib/periodization/planning-review-summary'
import type {
  IntegralPlanningReview,
  PlanningReviewCompetition,
  PlanningReviewMicrocycle,
} from '@/types/training/planning-review.types'

const baseEntity = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function buildMicrocycle({
  id,
  weekNumber,
  startDate,
  endDate,
  volume,
  elevation,
  duration,
  prescriptions,
}: {
  id: string
  weekNumber: number
  startDate: string
  endDate: string
  volume: number | null
  elevation: number | null
  duration: number | null
  prescriptions: number[]
}): PlanningReviewMicrocycle {
  return {
    microcycle: {
      ...baseEntity,
      id,
      mesocycleId: 'meso-1',
      weekNumber,
      type: 'development',
      startDate,
      endDate,
      targetVolumeKm: volume,
      targetVolumeSource: 'generated',
      targetElevationGain: elevation,
      targetElevationSource: 'generated',
      targetDurationMin: duration,
    },
    targets: {
      targetVolumeKm: volume,
      targetVolumeSource: 'generated',
      targetElevationGainM: elevation,
      targetElevationSource: 'generated',
      targetDurationMin: duration,
    },
    intensityTarget: null,
    sessions: prescriptions.map((prescriptionCount, sessionIndex) => ({
      session: {
        ...baseEntity,
        id: `session-${id}-${sessionIndex + 1}`,
        teamId: 'team-1',
        date: startDate,
        title: 'Rodaje',
        type: 'Base',
      },
      provenance: {
        ownership: 'generated',
        sharedEventKey: `event-${id}-${sessionIndex + 1}`,
      },
      prescriptions: Array.from({ length: prescriptionCount }, (_, prescriptionIndex) => ({
        prescription: {
          ...baseEntity,
          id: `prescription-${id}-${sessionIndex + 1}-${prescriptionIndex + 1}`,
          sessionId: `session-${id}-${sessionIndex + 1}`,
          groupId: 'group-1',
          microcycleId: id,
        },
        provenance: {
          ownership: 'generated',
          generationKey: `generation-${id}-${sessionIndex + 1}-${prescriptionIndex + 1}`,
        },
      })),
    })),
  }
}

function buildCompetition(
  id: string,
  date: string,
  priority: 'A' | 'B' | 'C',
): PlanningReviewCompetition {
  return {
    entry: {
      ...baseEntity,
      id,
      groupTrainingPlanId: 'plan-1',
      name: `Carrera ${priority}`,
      date,
      distanceKm: 21,
      elevationGainM: 900,
      priority,
      status: 'confirmed',
    },
    impactWindow: null,
  }
}

function buildReview(): IntegralPlanningReview {
  const weekTwo = buildMicrocycle({
    id: 'week-2',
    weekNumber: 2,
    startDate: '2026-01-12',
    endDate: '2026-01-18',
    volume: null,
    elevation: 900,
    duration: null,
    prescriptions: [1],
  })
  const weekOne = buildMicrocycle({
    id: 'week-1',
    weekNumber: 1,
    startDate: '2026-01-05',
    endDate: '2026-01-11',
    volume: 40,
    elevation: null,
    duration: 240,
    prescriptions: [2, 1],
  })

  return {
    scope: {
      teamId: 'team-1',
      groupId: 'group-1',
      groupTrainingPlanId: 'plan-1',
      kind: 'cohort_variant',
      planningCohortId: 'cohort-1',
      sourceGroupTrainingPlanId: 'base-plan-1',
    },
    plan: {
      ...baseEntity,
      id: 'plan-1',
      groupId: 'group-1',
      planningCohortId: 'cohort-1',
      sourceGroupTrainingPlanId: 'base-plan-1',
      title: 'Plan cohorte',
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
        endDate: '2026-01-18',
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
        microcycles: [weekTwo, weekOne],
      }],
    }],
    competitions: [
      buildCompetition('competition-b', '2026-01-15', 'B'),
      buildCompetition('competition-a', '2026-01-10', 'A'),
      buildCompetition('competition-outside', '2026-02-01', 'C'),
    ],
    protectedValues: [],
    issues: [],
  }
}

describe('resumen integral de planificación', () => {
  it('agrega volumen, desnivel, duración, sesiones y prescripciones por jerarquía', () => {
    const review = buildReview()
    const summary = buildIntegralPlanningReviewSummary(review)
    const mesocycle = summary.macrocycles[0].mesocycles[0]

    assert.deepEqual(summary.scope, review.scope)
    assert.deepEqual(summary.totals, {
      targetVolumeKm: 40,
      targetElevationGainM: 900,
      targetDurationMin: 240,
      microcycleCount: 2,
      sessionCount: 3,
      prescriptionCount: 4,
      competitionCount: 3,
    })
    assert.deepEqual(mesocycle.weeks.map(({ weekNumber }) => weekNumber), [1, 2])
    assert.equal(mesocycle.weeks[0].competitionCount, 1)
    assert.equal(mesocycle.weeks[1].competitionCount, 1)
    assert.equal(mesocycle.totals.competitionCount, 2)
    assert.equal(summary.macrocycles[0].totals.competitionCount, 2)
  })

  it('ordena calendario y jerarquía sin mutar el review original', () => {
    const review = buildReview()
    const originalWeekOrder = review.macrocycles[0].mesocycles[0].microcycles
      .map(({ microcycle }) => microcycle.id)
    const originalCompetitionOrder = review.competitions.map(({ entry }) => entry.id)

    const summary = buildIntegralPlanningReviewSummary(review)

    assert.deepEqual(
      summary.competitions.map(({ entry }) => entry.id),
      ['competition-a', 'competition-b', 'competition-outside'],
    )
    assert.deepEqual(
      summary.macrocycles[0].mesocycles[0].weeks.map(({ microcycleId }) => microcycleId),
      ['week-1', 'week-2'],
    )
    assert.deepEqual(
      review.macrocycles[0].mesocycles[0].microcycles
        .map(({ microcycle }) => microcycle.id),
      originalWeekOrder,
    )
    assert.deepEqual(
      review.competitions.map(({ entry }) => entry.id),
      originalCompetitionOrder,
    )
  })

  it('preserva alcance de variante de cohorte y ventanas competitivas', () => {
    const review = buildReview()
    review.competitions[0] = {
      ...review.competitions[0],
      impactWindow: {
        competitionId: 'competition-b',
        priority: 'B',
        competitionDate: '2026-01-15',
        pre: null,
        race: {
          startDate: '2026-01-15',
          endDate: '2026-01-15',
          durationDays: 1,
        },
        post: null,
        startDate: '2026-01-15',
        endDate: '2026-01-15',
        recovery: {
          priority: 'B',
          demand: {
            band: 'minimal',
            confidence: 'high',
            competitionDemandBand: 'very_low',
            courseEffortKm: 21,
            elevationLossM: null,
            downhillLoadKnown: false,
            technicalityKnown: false,
            requiresCoachReview: false,
          },
          planningProtection: 'contextual',
          phases: [],
          totalRecoveryDays: 0,
          requiresCoachReview: false,
          reasonCodes: ['competition_demand'],
        },
      },
    }

    const summary = buildIntegralPlanningReviewSummary(review)

    assert.equal(summary.scope.kind, 'cohort_variant')
    assert.equal(summary.scope.sourceGroupTrainingPlanId, 'base-plan-1')
    assert.equal(
      summary.competitions.find(({ entry }) => entry.id === 'competition-b')?.impactWindow
        ?.competitionId,
      'competition-b',
    )
  })
})
