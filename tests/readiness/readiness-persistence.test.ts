import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  persistReadinessCoachReview,
  persistReadinessEvaluation,
} from '@/lib/readiness/readiness-persistence'
import { H12_READINESS_POLICY_DRAFT_V1 } from '@/lib/readiness/readiness-policy'
import type {
  PersistedReadinessEvaluation,
  ReadinessAssessment,
  ReadinessCoachReview,
  ReadinessEvaluationPersistencePort,
} from '@/types'

interface MemoryState {
  evaluations: Map<string, PersistedReadinessEvaluation>
  reviews: ReadinessCoachReview[]
}

class MemoryReadinessPort implements ReadinessEvaluationPersistencePort<MemoryState> {
  readonly state: MemoryState = {
    evaluations: new Map(),
    reviews: [],
  }

  transaction<TResult>(work: (tx: MemoryState) => TResult): TResult {
    const evaluationSnapshot = new Map(this.state.evaluations)
    const reviewSnapshot = [...this.state.reviews]
    try {
      return work(this.state)
    } catch (error) {
      this.state.evaluations.clear()
      for (const [key, value] of evaluationSnapshot) this.state.evaluations.set(key, value)
      this.state.reviews.splice(0, this.state.reviews.length, ...reviewSnapshot)
      throw error
    }
  }

  insertEvaluation(tx: MemoryState, evaluation: PersistedReadinessEvaluation): void {
    tx.evaluations.set(evaluation.id, structuredClone(evaluation))
  }

  findEvaluation(tx: MemoryState, evaluationId: string): PersistedReadinessEvaluation | null {
    return tx.evaluations.get(evaluationId) ?? null
  }

  listReviews(tx: MemoryState, evaluationId: string): readonly ReadinessCoachReview[] {
    return tx.reviews.filter(({ assessmentId }) => assessmentId === evaluationId)
  }

  appendReview(tx: MemoryState, review: ReadinessCoachReview): void {
    tx.reviews.push(structuredClone(review))
  }
}

function assessment(): ReadinessAssessment {
  const unknown = (unit: 'km' | 'km_per_week' | 'min' | 'min_per_week' | 'm' | 'm_per_week' | 'sessions_per_week' | 'ratio' | 'bpm' | 'rpe') => ({
    state: 'unknown' as const,
    unit,
    sampleSize: 0,
    coverageRatio: 0,
    reason: 'insufficient_data' as const,
  })

  return {
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
        profile: { distanceKm: 21, elevationGainM: 700, source: 'derived' },
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
      volume: { totalKm: unknown('km'), averageWeeklyKm: unknown('km_per_week') },
      duration: { totalMin: unknown('min'), averageWeeklyMin: unknown('min_per_week') },
      elevation: { totalGainM: unknown('m'), averageWeeklyGainM: unknown('m_per_week') },
      frequency: { recordedSessionsPerWeek: unknown('sessions_per_week') },
      intensity: { averageRpe: unknown('rpe'), averageHrBpm: unknown('bpm') },
      longRun: {
        longestDistanceKm: unknown('km'),
        longestDurationMin: unknown('min'),
        peakElevationGainM: unknown('m'),
      },
      continuity: { activeBucketRatio: unknown('ratio'), activeBuckets: 0, totalBuckets: 4 },
      limitations: ['insufficient_overall_data'],
    },
    policyVersion: H12_READINESS_POLICY_DRAFT_V1.version,
    policyStatus: H12_READINESS_POLICY_DRAFT_V1.status,
    limitations: ['insufficient_overall_data', 'draft_policy_thresholds'],
    alerts: [],
  }
}

describe('readiness persistence', () => {
  it('persiste evaluación con snapshot de reglas y replay por ID sin duplicar', () => {
    const port = new MemoryReadinessPort()
    const input = {
      id: 'evaluation-1',
      assessment: assessment(),
      policy: H12_READINESS_POLICY_DRAFT_V1,
      persistence: port,
    }

    const first = persistReadinessEvaluation(input)
    const replay = persistReadinessEvaluation(input)

    assert.equal(first.id, 'evaluation-1')
    assert.deepEqual(replay, first)
    assert.equal(port.state.evaluations.size, 1)
    assert.equal(first.policySnapshot.version, H12_READINESS_POLICY_DRAFT_V1.version)
  })

  it('rechaza snapshot de reglas que no corresponde al resultado automático', () => {
    const port = new MemoryReadinessPort()
    assert.throws(() => persistReadinessEvaluation({
      id: 'evaluation-1',
      assessment: assessment(),
      policy: { ...H12_READINESS_POLICY_DRAFT_V1, version: 'other-version' },
      persistence: port,
    }), /policy snapshot version mismatch/)
    assert.equal(port.state.evaluations.size, 0)
  })

  it('persiste la decisión del profesor como historial separado del assessment', () => {
    const port = new MemoryReadinessPort()
    const automatic = assessment()
    persistReadinessEvaluation({
      id: 'evaluation-1',
      assessment: automatic,
      policy: H12_READINESS_POLICY_DRAFT_V1,
      persistence: port,
    })

    persistReadinessCoachReview({
      review: {
        assessmentId: 'evaluation-1',
        teamId: 'team-1',
        athleteId: 'athlete-1',
        decision: 'needs_planning_review',
        reviewedByUserId: 'coach-1',
        reviewedAt: '2026-09-12T22:10:00.000Z',
        note: 'Revisar progresión de carga.',
      },
      persistence: port,
    })

    assert.equal(port.state.reviews.length, 1)
    assert.equal(automatic.status, 'insufficient_data')
    assert.deepEqual(automatic.alerts, [])
  })

  it('rechaza una revisión cross-athlete y revierte sin side effects', () => {
    const port = new MemoryReadinessPort()
    persistReadinessEvaluation({
      id: 'evaluation-1',
      assessment: assessment(),
      policy: H12_READINESS_POLICY_DRAFT_V1,
      persistence: port,
    })

    assert.throws(() => persistReadinessCoachReview({
      review: {
        assessmentId: 'evaluation-1',
        teamId: 'team-1',
        athleteId: 'athlete-2',
        decision: 'acknowledged',
        reviewedByUserId: 'coach-1',
        reviewedAt: '2026-09-12T22:10:00.000Z',
        note: null,
      },
      persistence: port,
    }), /crosses evaluation scope/)
    assert.equal(port.state.reviews.length, 0)
  })
})
