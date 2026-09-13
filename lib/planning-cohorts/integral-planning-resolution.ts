import {
  resolveAthletePlanningOnDate,
  type AthletePlanningResolution,
} from '@/lib/planning-cohorts/planning-resolution'
import { buildIntegralPlanningReviewSummary } from '@/lib/periodization/planning-review-summary'
import { validateIntegralPlanningReview } from '@/lib/periodization/planning-review-validator'
import type {
  IntegralPlanningReview,
  IntegralPlanningReviewSummary,
  PlanningReviewIssue,
} from '@/types/training/planning-review.types'

type ResolutionInput = Parameters<typeof resolveAthletePlanningOnDate>[0]
type UpstreamNonResolved = Exclude<AthletePlanningResolution, { status: 'resolved' }>

export type AthleteIntegralPlanningResolution =
  | UpstreamNonResolved
  | {
      status: 'conflict'
      reason: 'resolved-review-count' | 'resolved-review-scope' | 'resolved-review-integrity'
      groupId: string
      conflictingIds: string[]
      issues?: readonly PlanningReviewIssue[]
    }
  | {
      status: 'resolved'
      source: 'cohort' | 'group'
      groupId: string
      planId: string
      cohortId: string | null
      review: IntegralPlanningReview
      summary: IntegralPlanningReviewSummary
    }

function unique(values: readonly string[]) {
  return [...new Set(values)]
}

/**
 * Resolves athlete -> dated cohort/group plan and returns exactly that complete
 * H11 review aggregate. Selection happens before summary projection, so sessions,
 * prescriptions and calendar competitions can never be assembled from different
 * base/variant reviews.
 */
export function resolveAthleteIntegralPlanningOnDate(input: {
  planning: ResolutionInput
  reviews: readonly IntegralPlanningReview[]
}): AthleteIntegralPlanningResolution {
  const resolution = resolveAthletePlanningOnDate(input.planning)
  if (resolution.status !== 'resolved') return resolution

  const matchingReviews = input.reviews.filter(
    ({ scope }) => scope.groupTrainingPlanId === resolution.planId,
  )

  if (matchingReviews.length !== 1) {
    return {
      status: 'conflict',
      reason: 'resolved-review-count',
      groupId: resolution.groupId,
      conflictingIds: matchingReviews.map(({ plan }) => plan.id),
    }
  }

  const review = matchingReviews[0]
  const expectedKind = resolution.source === 'cohort'
    ? 'cohort_variant'
    : 'group_base'
  const scopeMatchesResolution = review.scope.teamId === input.planning.athleteTeamId
    && review.scope.groupId === resolution.groupId
    && review.scope.kind === expectedKind
    && review.scope.planningCohortId === resolution.cohortId
    && (
      resolution.source === 'cohort'
        ? review.scope.sourceGroupTrainingPlanId !== null
        : review.scope.sourceGroupTrainingPlanId === null
    )

  if (!scopeMatchesResolution) {
    return {
      status: 'conflict',
      reason: 'resolved-review-scope',
      groupId: resolution.groupId,
      conflictingIds: [review.plan.id],
    }
  }

  const validation = validateIntegralPlanningReview(review)
  if (!validation.isValid) {
    return {
      status: 'conflict',
      reason: 'resolved-review-integrity',
      groupId: resolution.groupId,
      conflictingIds: unique(validation.issues.flatMap(({ references }) => (
        references.map(({ entityId }) => entityId)
      ))),
      issues: validation.issues,
    }
  }

  return {
    ...resolution,
    review,
    summary: buildIntegralPlanningReviewSummary(review),
  }
}
