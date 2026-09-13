import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildReadinessCoachReview } from '@/lib/readiness/readiness-review'
import type { ReadinessAssessment } from '@/types'

const assessment: ReadinessAssessment = {
  status: 'insufficient_data',
  teamId: 'team-1',
  athleteId: 'athlete-1',
  evaluatedAt: '2026-09-12T22:00:00.000Z',
  target: {
    scope: {
      teamId: 'team-1',
      groupId: 'group-1',
      groupTrainingPlanId: 'plan-1',
      kind: 'group_base',
      planningCohortId: null,
      sourceGroupTrainingPlanId: null,
    },
    competitionEntryId: 'race-1',
    name: 'Trail',
    date: '2026-10-11',
    distanceKm: 21,
    elevationGainM: 700,
    priority: 'A',
    demand: {
      courseEffortKm: 28,
      band: 'low',
      confidence: 'medium',
      profile: { distanceKm: 21, elevationGainM: 700 },
      limitations: {
        elevationGainKnown: true,
        elevationLossKnown: false,
        altitudeProfileKnown: false,
        technicalityKnown: false,
      },
    },
    impactWindow: null,
  },
  phase: {
    evaluationDate: '2026-09-12',
    competitionDate: '2026-10-11',
    phase: 'preparation',
    daysUntilCompetition: 29,
  },
  summary: {
    teamId: 'team-1',
    athleteId: 'athlete-1',
    window: { startDate: '2026-08-16', endDate: '2026-09-12', windowDays: 28, bucketDays: 7 },
    dataStatus: 'insufficient_data',
    performedRecords: 0,
    volume: {
      totalKm: { state: 'unknown', unit: 'km', sampleSize: 0, coverageRatio: 0, reason: 'insufficient_data' },
      averageWeeklyKm: { state: 'unknown', unit: 'km_per_week', sampleSize: 0, coverageRatio: 0, reason: 'insufficient_data' },
    },
    duration: {
      totalMin: { state: 'unknown', unit: 'min', sampleSize: 0, coverageRatio: 0, reason: 'insufficient_data' },
      averageWeeklyMin: { state: 'unknown', unit: 'min_per_week', sampleSize: 0, coverageRatio: 0, reason: 'insufficient_data' },
    },
    elevation: {
      totalGainM: { state: 'unknown', unit: 'm', sampleSize: 0, coverageRatio: 0, reason: 'insufficient_data' },
      averageWeeklyGainM: { state: 'unknown', unit: 'm_per_week', sampleSize: 0, coverageRatio: 0, reason: 'insufficient_data' },
    },
    frequency: {
      recordedSessionsPerWeek: { state: 'unknown', unit: 'sessions_per_week', sampleSize: 0, coverageRatio: 0, reason: 'insufficient_data' },
    },
    intensity: {
      averageRpe: { state: 'unknown', unit: 'rpe', sampleSize: 0, coverageRatio: 0, reason: 'insufficient_data' },
      averageHrBpm: { state: 'unknown', unit: 'bpm', sampleSize: 0, coverageRatio: 0, reason: 'insufficient_data' },
    },
    longRun: {
      longestDistanceKm: { state: 'unknown', unit: 'km', sampleSize: 0, coverageRatio: 0, reason: 'insufficient_data' },
      longestDurationMin: { state: 'unknown', unit: 'min', sampleSize: 0, coverageRatio: 0, reason: 'insufficient_data' },
      peakElevationGainM: { state: 'unknown', unit: 'm', sampleSize: 0, coverageRatio: 0, reason: 'insufficient_data' },
    },
    continuity: {
      activeBucketRatio: { state: 'unknown', unit: 'ratio', sampleSize: 0, coverageRatio: 0, reason: 'insufficient_data' },
      activeBuckets: 0,
      totalBuckets: 4,
    },
    limitations: ['insufficient_overall_data'],
  },
  policyVersion: 'h12-readiness-v1-draft',
  policyStatus: 'draft',
  limitations: ['insufficient_overall_data'],
  alerts: [],
}

describe('coach readiness review', () => {
  it('mantiene la decisión del profesor separada del resultado automático', () => {
    const review = buildReadinessCoachReview({
      assessment,
      assessmentId: 'assessment-1',
      decision: 'acknowledged',
      reviewedByUserId: 'coach-1',
      reviewedAt: '2026-09-12T22:10:00.000Z',
    })

    assert.equal(review.decision, 'acknowledged')
    assert.equal(assessment.status, 'insufficient_data')
    assert.deepEqual(assessment.alerts, [])
  })

  it('exige contexto cuando el profesor solicita revisar la planificación', () => {
    assert.throws(() => buildReadinessCoachReview({
      assessment,
      assessmentId: 'assessment-1',
      decision: 'needs_planning_review',
      reviewedByUserId: 'coach-1',
      reviewedAt: '2026-09-12T22:10:00.000Z',
      note: '   ',
    }), /requires a note/)
  })
})
