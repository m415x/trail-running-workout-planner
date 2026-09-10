import type { CompetitionEntry, CompetitionEntryDraft } from '@/types/training/competition-entry.types'
import type { GroupTrainingPlanKind } from '@/types/training/periodization.types'
import { validateCompetitionEntryDraft } from '@/lib/periodization/competition-entry'
import { isCompetitionActiveForPlanning } from '@/lib/periodization/competition-lifecycle'
import { validateCompetitionOwnership } from '@/lib/periodization/competition-ownership'

export type CompetitionCalendarPolicyErrorCode =
  | 'competition_calendar_entry_invalid'
  | 'competition_calendar_owner_invalid'
  | 'competition_calendar_outside_plan_horizon'
  | 'competition_calendar_multiple_primary_candidates'

export interface CompetitionCalendarMacrocycleWindow {
  readonly id: string
  readonly startDate: string
  readonly endDate: string
}

export interface CompetitionCalendarPolicyInput {
  readonly draft: CompetitionEntryDraft
  readonly planKind: GroupTrainingPlanKind
  readonly coversEntirePlanAudience: boolean
  readonly macrocycles: readonly CompetitionCalendarMacrocycleWindow[]
  readonly existingCompetitions: readonly CompetitionEntry[]
  /** Existing entry being edited. Omit for creation. */
  readonly currentCompetitionId?: string
}

export type CompetitionCalendarPolicyResult =
  | {
      readonly valid: true
      /** Same-day entries are contextual information, not an automatic error. */
      readonly sameDateCompetitionIds: readonly string[]
    }
  | {
      readonly valid: false
      readonly errors: readonly CompetitionCalendarPolicyErrorCode[]
      readonly sameDateCompetitionIds: readonly string[]
    }

/**
 * Validates one calendar mutation against plan-level invariants.
 *
 * Same-day competitions are intentionally reported but not rejected. There is
 * no sports policy yet that makes proximity or equal dates invalid by itself.
 * Multiple active A competitions are rejected only when they both fall inside
 * the same macrocycle horizon.
 */
export function validateCompetitionCalendarMutation(
  input: CompetitionCalendarPolicyInput,
): CompetitionCalendarPolicyResult {
  const errors: CompetitionCalendarPolicyErrorCode[] = []
  const entryValidation = validateCompetitionEntryDraft(input.draft)

  if (!entryValidation.valid) {
    errors.push('competition_calendar_entry_invalid')
  }

  const ownership = validateCompetitionOwnership({
    planKind: input.planKind,
    coversEntirePlanAudience: input.coversEntirePlanAudience,
  })

  if (!ownership.valid) {
    errors.push('competition_calendar_owner_invalid')
  }

  const activeExisting = input.existingCompetitions.filter((competition) =>
    competition.id !== input.currentCompetitionId &&
    !competition.isDeleted &&
    isCompetitionActiveForPlanning(competition.status),
  )

  const sameDateCompetitionIds = activeExisting
    .filter((competition) => competition.date === input.draft.date)
    .map((competition) => competition.id)

  const applicableMacrocycles = input.macrocycles.filter((macrocycle) =>
    input.draft.date >= macrocycle.startDate && input.draft.date <= macrocycle.endDate,
  )

  if (input.macrocycles.length > 0 && applicableMacrocycles.length === 0) {
    errors.push('competition_calendar_outside_plan_horizon')
  }

  if (
    input.draft.priority === 'A' &&
    isCompetitionActiveForPlanning(input.draft.status) &&
    applicableMacrocycles.some((macrocycle) =>
      activeExisting.some((competition) =>
        competition.priority === 'A' &&
        competition.date >= macrocycle.startDate &&
        competition.date <= macrocycle.endDate,
      ),
    )
  ) {
    errors.push('competition_calendar_multiple_primary_candidates')
  }

  return errors.length === 0
    ? { valid: true, sameDateCompetitionIds }
    : { valid: false, errors, sameDateCompetitionIds }
}
