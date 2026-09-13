import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildReadinessAssessment } from '@/lib/readiness/readiness-assessment'
import { H12_READINESS_POLICY_DRAFT_V1 } from '@/lib/readiness/readiness-policy'
import type {
  ReadinessCompetitionTarget,
  ReadinessEvaluationPhaseResolution,
  RecentPreparationSummary,
} from '@/types'

function known(value: number, unit: 'km' | 'min' | 'm' | 'ratio' | 'rpe' | 'bpm' | 'sessions_per_week' | 'km_per_week' | 'min_per_week' | 'm_per_week') {
  return { state: 'known' as const, value, unit, sampleSize: 6, coverageRatio: 1 }
}

function summary(dataStatus: 'sufficient' | 'insufficient_data' = 'sufficient'): RecentPreparationSummary {
  return {
    teamId: 'team-1',
    athleteId: 'athlete-1',
    window: { startDate: '2026-09-01', endDate: '2026-09-28', windowDays: 28, bucketDays: 7 },
    dataStatus,
    performedRecords: dataStatus === 'sufficient' ? 8 : 1,
    volume: { totalKm: known(80, 'km'), averageWeeklyKm: known(20, 'km_per_week') },
    duration: { totalMin: known(500, 'min'), averageWeeklyMin: known(125, 'min_per_week') },
    elevation: { totalGainM: known(2400, 'm'), averageWeeklyGainM: known(600, 'm_per_week') },
    frequency: { recordedSessionsPerWeek: known(2, 'sessions_per_week') },
    intensity: { averageRpe: known(5, 'rpe'), averageHrBpm: known(145, 'bpm') },
    longRun: {
      longestDistanceKm: known(12, 'km'),
      longestDurationMin: known(85, 'min'),
      peakElevationGainM: known(350, 'm'),
    },
    continuity: { activeBucketRatio: known(0.75, 'ratio'), activeBuckets: 3, totalBuckets: 4 },
    limitations: dataStatus === 'sufficient' ? [] : ['insufficient_overall_data'],
  }
}

function target(): ReadinessCompetitionTarget {
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
    distanceKm: 42,
    elevationGainM: 1600,
    priority: 'A',
    demand: {
      courseEffortKm: 58,
      band: 'moderate',
      confidence: 'medium',
      profile: { distanceKm: 42, elevationGainM: 1600, source: 'derived' },
      limitations: {
        elevationGainKnown: true,
        elevationLossKnown: false,
        altitudeProfileKnown: false,
        technicalityKnown: false,
      },
    },
    impactWindow: null,
  }
}

function phase(value: ReadinessEvaluationPhaseResolution['phase']): ReadinessEvaluationPhaseResolution {
  return {
    evaluationDate: '2026-09-28',
    competitionDate: '2026-10-11',
    phase: value,
    daysUntilCompetition: 13,
  }
}

describe('readiness assessment', () => {
  it('datos insuficientes nunca se convierten en una falsa evaluación sin alertas', () => {
    const result = buildReadinessAssessment({
      evaluatedAt: '2026-09-28T20:00:00.000Z',
      summary: summary('insufficient_data'),
      target: target(),
      phase: phase('preparation'),
      policy: H12_READINESS_POLICY_DRAFT_V1,
    })

    assert.equal(result.status, 'insufficient_data')
    assert.deepEqual(result.alerts, [])
  })

  it('explica por separado desajustes recientes de distancia y D+ frente a la carrera', () => {
    const result = buildReadinessAssessment({
      evaluatedAt: '2026-09-28T20:00:00.000Z',
      summary: summary(),
      target: target(),
      phase: phase('preparation'),
      policy: H12_READINESS_POLICY_DRAFT_V1,
    })

    assert.equal(result.status, 'assessed')
    assert.deepEqual(
      result.alerts.map(({ code }) => code),
      ['competition_distance_exposure_gap', 'competition_elevation_exposure_gap'],
    )
    assert.equal(result.alerts[0]?.rule.policyVersion, H12_READINESS_POLICY_DRAFT_V1.version)
    assert.deepEqual(result.alerts[0]?.period, { startDate: '2026-09-01', endDate: '2026-09-28' })
    assert.ok(result.limitations.includes('draft_policy_thresholds'))
  })

  it('no transforma la reducción deliberada de taper en una alerta de continuidad', () => {
    const result = buildReadinessAssessment({
      evaluatedAt: '2026-10-06T20:00:00.000Z',
      summary: summary(),
      target: target(),
      phase: {
        evaluationDate: '2026-10-06',
        competitionDate: '2026-10-11',
        phase: 'taper',
        daysUntilCompetition: 5,
      },
      policy: H12_READINESS_POLICY_DRAFT_V1,
      continuity: {
        status: 'below_threshold',
        observedActiveBucketRatio: 0.5,
        threshold: 0.75,
      },
    })

    assert.equal(result.alerts.some(({ code }) => code === 'continuity_gap'), false)
  })
})
