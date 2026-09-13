import type {
  ReadinessCoachReview,
  ReadinessCoachReviewDraft,
} from '@/types/training/readiness-review.types'

export function buildReadinessCoachReview(
  draft: ReadinessCoachReviewDraft,
): ReadinessCoachReview {
  if (draft.assessmentId.trim().length === 0) throw new Error('assessmentId is required')
  if (draft.reviewedByUserId.trim().length === 0) throw new Error('reviewedByUserId is required')
  if (Number.isNaN(Date.parse(draft.reviewedAt))) throw new Error('reviewedAt must be a valid timestamp')

  const note = draft.note?.trim() || null
  if (draft.decision === 'needs_planning_review' && note === null) {
    throw new Error('A planning review decision requires a note')
  }

  return {
    assessmentId: draft.assessmentId,
    teamId: draft.assessment.teamId,
    athleteId: draft.assessment.athleteId,
    decision: draft.decision,
    reviewedByUserId: draft.reviewedByUserId,
    reviewedAt: draft.reviewedAt,
    note,
  }
}
