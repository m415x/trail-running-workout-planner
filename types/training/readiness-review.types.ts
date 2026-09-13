import type { ReadinessAssessment } from '@/types/training/readiness-assessment.types'

export type ReadinessCoachDecision = 'acknowledged' | 'needs_planning_review'

export interface ReadinessCoachReview {
  readonly assessmentId: string
  readonly teamId: string
  readonly athleteId: string
  readonly decision: ReadinessCoachDecision
  readonly reviewedByUserId: string
  readonly reviewedAt: string
  readonly note: string | null
}

export interface ReadinessCoachReviewDraft {
  readonly assessment: ReadinessAssessment
  readonly assessmentId: string
  readonly decision: ReadinessCoachDecision
  readonly reviewedByUserId: string
  readonly reviewedAt: string
  readonly note?: string | null
}
