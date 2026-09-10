import type { CompetitionStatus } from '@/types/training/competition-entry.types'

export type CompetitionLifecycleErrorCode =
  | 'competition_lifecycle_transition_not_allowed'

export type CompetitionLifecycleTransitionResult =
  | { readonly valid: true }
  | {
      readonly valid: false
      readonly error: CompetitionLifecycleErrorCode
    }

const VALID_TRANSITIONS: Readonly<Record<CompetitionStatus, readonly CompetitionStatus[]>> = {
  planned: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

/**
 * Returns whether a competition participates in forward-looking planning.
 *
 * Planned and confirmed entries remain active planning context. Completed and
 * cancelled entries remain visible historically but must not condition future
 * planning.
 */
export function isCompetitionActiveForPlanning(status: CompetitionStatus): boolean {
  return status === 'planned' || status === 'confirmed'
}

/**
 * Validates one explicit lifecycle transition.
 *
 * Reprogramming is intentionally not a lifecycle state: changing a competition
 * date may preserve the current status. Completed and cancelled are terminal in
 * the MVP so history is never silently reopened.
 */
export function validateCompetitionStatusTransition(
  from: CompetitionStatus,
  to: CompetitionStatus,
): CompetitionLifecycleTransitionResult {
  if (VALID_TRANSITIONS[from].includes(to)) {
    return { valid: true }
  }

  return {
    valid: false,
    error: 'competition_lifecycle_transition_not_allowed',
  }
}
