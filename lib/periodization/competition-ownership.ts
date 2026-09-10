import type { GroupTrainingPlanKind } from '@/types/training/periodization.types'

export type CompetitionOwnershipErrorCode =
  | 'competition_owner_plan_kind_invalid'
  | 'competition_owner_partial_audience_not_allowed'

export type CompetitionOwnershipContext = {
  readonly planKind: GroupTrainingPlanKind
  /**
   * True only when every athlete represented by the owning plan is part of the
   * competition audience. For a base plan this means the whole AthleteGroup;
   * for a cohort variant it means the whole PlanningCohort audience.
   */
  readonly coversEntirePlanAudience: boolean
}

export type CompetitionOwnershipResult =
  | {
      readonly valid: true
      readonly ownerKind: GroupTrainingPlanKind
    }
  | {
      readonly valid: false
      readonly errors: readonly CompetitionOwnershipErrorCode[]
    }

const PLAN_KINDS: readonly GroupTrainingPlanKind[] = ['group_base', 'cohort_variant']

/**
 * Validates whether a CompetitionEntry may be owned by a GroupTrainingPlan.
 *
 * Ownership is always technical at the plan level. The competition must cover
 * the entire audience represented by that plan. If only part of a base group's
 * athletes participate, the correct owner is a cohort variant rather than the
 * base plan.
 */
export function validateCompetitionOwnership(
  context: CompetitionOwnershipContext,
): CompetitionOwnershipResult {
  const errors: CompetitionOwnershipErrorCode[] = []

  if (!PLAN_KINDS.includes(context.planKind)) {
    errors.push('competition_owner_plan_kind_invalid')
  }

  if (!context.coversEntirePlanAudience) {
    errors.push('competition_owner_partial_audience_not_allowed')
  }

  return errors.length === 0
    ? { valid: true, ownerKind: context.planKind }
    : { valid: false, errors }
}
