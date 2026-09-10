import type {
  CompetitionEntryDraft,
  CompetitionPriority,
  CompetitionStatus,
} from '@/types/training/competition-entry.types'

export type CompetitionEntryValidationErrorCode =
  | 'competition_entry_group_training_plan_required'
  | 'competition_entry_name_required'
  | 'competition_entry_date_invalid'
  | 'competition_entry_distance_invalid'
  | 'competition_entry_elevation_gain_invalid'
  | 'competition_entry_priority_invalid'
  | 'competition_entry_status_invalid'

export type CompetitionEntryValidationResult =
  | { readonly valid: true }
  | {
      readonly valid: false
      readonly errors: readonly CompetitionEntryValidationErrorCode[]
    }

const COMPETITION_PRIORITIES: readonly CompetitionPriority[] = ['A', 'B', 'C']
const COMPETITION_STATUSES: readonly CompetitionStatus[] = ['scheduled', 'cancelled']

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/**
 * Validates the minimum domain invariants required for a competition to act as
 * planning context. Detailed priority semantics and lifecycle transitions are
 * intentionally handled by later H9 tasks.
 */
export function validateCompetitionEntryDraft(
  draft: CompetitionEntryDraft,
): CompetitionEntryValidationResult {
  const errors: CompetitionEntryValidationErrorCode[] = []

  if (!draft.groupTrainingPlanId.trim()) {
    errors.push('competition_entry_group_training_plan_required')
  }

  if (!draft.name.trim()) {
    errors.push('competition_entry_name_required')
  }

  if (!isValidIsoDate(draft.date)) {
    errors.push('competition_entry_date_invalid')
  }

  if (!Number.isFinite(draft.distanceKm) || draft.distanceKm <= 0) {
    errors.push('competition_entry_distance_invalid')
  }

  if (
    draft.elevationGainM !== undefined &&
    draft.elevationGainM !== null &&
    (!Number.isFinite(draft.elevationGainM) || draft.elevationGainM < 0)
  ) {
    errors.push('competition_entry_elevation_gain_invalid')
  }

  if (!COMPETITION_PRIORITIES.includes(draft.priority)) {
    errors.push('competition_entry_priority_invalid')
  }

  if (!COMPETITION_STATUSES.includes(draft.status)) {
    errors.push('competition_entry_status_invalid')
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors }
}
