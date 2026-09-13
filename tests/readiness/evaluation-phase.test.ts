import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  resolveReadinessEvaluationPhase,
  suppressExpectedReducedLoadAlert,
} from '@/lib/readiness/evaluation-phase'
import { H12_READINESS_POLICY_DRAFT_V1 } from '@/lib/readiness/readiness-policy'
import type { ReadinessCompetitionTarget } from '@/types'

function target(): ReadinessCompetitionTarget {
  const recovery = {
    priority: 'A' as const,
    demand: {
      band: 'moderate' as const,
      confidence: 'medium' as const,
      competitionDemandBand: 'moderate' as const,
      courseEffortKm: 42,
      elevationLossM: null,
      downhillLoadKnown: false,
      technicalityKnown: false,
      requiresCoachReview: false,
    },
    planningProtection: 'protected' as const,
    phases: [
      { phase: 'acute_recovery' as const, durationDays: 2, trainingLoadCeilingPercentage: 20, allowIntenseSessions: false },
      { phase: 'recovery' as const, durationDays: 3, trainingLoadCeilingPercentage: 50, allowIntenseSessions: false },
      { phase: 'progressive_reentry' as const, durationDays: 2, trainingLoadCeilingPercentage: 75, allowIntenseSessions: true },
    ],
    totalRecoveryDays: 7,
    requiresCoachReview: false,
    reasonCodes: ['competition_demand' as const],
  }
  return {
    scope: {
      teamId: 'team-1',
      groupId: 'group-1',
      groupTrainingPlanId: 'plan-1',
      kind: 'cohort_variant',
      planningCohortId: 'cohort-1',
      sourceGroupTrainingPlanId: 'base-plan',
    },
    competitionEntryId: 'race-1',
    name: 'Trail objetivo',
    date: '2026-10-11',
    distanceKm: 32,
    elevationGainM: 1000,
    priority: 'A',
    demand: {
      courseEffortKm: 42,
      band: 'low',
      confidence: 'medium',
      profile: { distanceKm: 32, elevationGainM: 1000, source: 'derived' },
      limitations: {
        elevationGainKnown: true,
        elevationLossKnown: false,
        altitudeProfileKnown: false,
        technicalityKnown: false,
      },
    },
    impactWindow: {
      competitionId: 'race-1',
      priority: 'A',
      competitionDate: '2026-10-11',
      pre: { startDate: '2026-10-04', endDate: '2026-10-10', durationDays: 7 },
      race: { startDate: '2026-10-11', endDate: '2026-10-11', durationDays: 1 },
      post: { startDate: '2026-10-12', endDate: '2026-10-18', durationDays: 7 },
      startDate: '2026-10-04',
      endDate: '2026-10-18',
      recovery,
    },
  }
}

describe('readiness evaluation phase', () => {
  it('distingue preparación, taper, carrera y fases de recuperación H10', () => {
    const expected = [
      ['2026-10-01', 'preparation'],
      ['2026-10-05', 'taper'],
      ['2026-10-11', 'competition'],
      ['2026-10-12', 'acute_recovery'],
      ['2026-10-14', 'recovery'],
      ['2026-10-17', 'reentry'],
      ['2026-10-20', 'post_recovery'],
    ] as const

    for (const [evaluationDate, phase] of expected) {
      assert.equal(resolveReadinessEvaluationPhase({ evaluationDate, target: target() }).phase, phase)
    }
  })

  it('suprime alertas de reducción esperada durante taper y recuperación según policy', () => {
    assert.equal(suppressExpectedReducedLoadAlert({ phase: 'taper', policy: H12_READINESS_POLICY_DRAFT_V1 }), true)
    assert.equal(suppressExpectedReducedLoadAlert({ phase: 'recovery', policy: H12_READINESS_POLICY_DRAFT_V1 }), true)
    assert.equal(suppressExpectedReducedLoadAlert({ phase: 'preparation', policy: H12_READINESS_POLICY_DRAFT_V1 }), false)
  })
})
