import type {
  CompetitionEntry,
  CompetitionPriority,
} from '@/types/training/competition-entry.types'

export type CompetitionRole =
  | 'primary_candidate'
  | 'preparatory'
  | 'secondary'

export type CompetitionPriorityErrorCode =
  'competition_priority_multiple_primary_candidates'

export type CompetitionPriorityResult =
  | {
      readonly valid: true
      readonly primaryCandidate: CompetitionEntry | null
    }
  | {
      readonly valid: false
      readonly errors: readonly CompetitionPriorityErrorCode[]
    }

/**
 * Returns the planning role represented by a competition priority.
 *
 * Priority describes the role of an event in the competitive calendar. It does
 * not itself change load, intensity or tapering behaviour.
 */
export function getCompetitionRole(priority: CompetitionPriority): CompetitionRole {
  switch (priority) {
    case 'A':
      return 'primary_candidate'
    case 'B':
      return 'preparatory'
    case 'C':
      return 'secondary'
  }
}

/**
 * Resolves the A-priority candidate for one already-scoped macrocycle context.
 *
 * Callers are responsible for supplying only entries that belong to the
 * macrocycle's competitive horizon and participate in the active calendar.
 * This keeps priority independent from lifecycle semantics, which are defined
 * separately. B and C entries remain contextual events and cannot become the
 * primary competition through this policy.
 */
export function resolvePrimaryCompetitionCandidate(
  scopedActiveEntries: readonly CompetitionEntry[],
): CompetitionPriorityResult {
  const primaryCandidates = scopedActiveEntries.filter(
    (entry) => getCompetitionRole(entry.priority) === 'primary_candidate',
  )

  if (primaryCandidates.length > 1) {
    return {
      valid: false,
      errors: ['competition_priority_multiple_primary_candidates'],
    }
  }

  return {
    valid: true,
    primaryCandidate: primaryCandidates[0] ?? null,
  }
}
