import { createHash } from 'node:crypto'

import type { IntegralPlanningReview } from '@/types/training/planning-review.types'

function normalize(value: unknown): unknown {
  if (value === undefined) return { $undefined: true }
  if (Array.isArray(value)) return value.map(normalize)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, current]) => [key, normalize(current)]),
    )
  }
  return value
}

/**
 * Produces a deterministic optimistic-concurrency token for the authoritative
 * planning review state used as the source of a coach decision.
 *
 * Derived validation issues are excluded because they are diagnostics over the
 * represented state, not persisted planning data. Hierarchy array order is kept
 * because H11 stable macrocycle ordinals are semantically significant.
 */
export function integralPlanningReviewRevisionKey(review: IntegralPlanningReview) {
  const authoritativeReview = Object.fromEntries(
    Object.entries(review).filter(([key]) => key !== 'issues'),
  )

  return createHash('sha256')
    .update(JSON.stringify(normalize(authoritativeReview)))
    .digest('hex')
}
