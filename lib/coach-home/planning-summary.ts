/** Presentational projection only. Caller must supply the H2/H3/H4A-authorized Plan list. */
type PlanningReadStatus = 'denied' | 'selection_required' | 'invalid_context' | 'empty' | 'error'

type SourceMicrocycle = {
  id: string
  weekNumber: number
  startDate: string
  endDate: string
  type: string
  targetVolumeKm: number | null
  isDeleted: boolean
}
type SourcePlan = {
  id: string
  teamId: string
  groupId: string
  title: string
  status: string
  sourceGroupTrainingPlanId: string | null
  macrocycles: readonly {
    isDeleted: boolean
    mesocycles: readonly {
      isDeleted: boolean
      microcycles: readonly SourceMicrocycle[]
    }[]
  }[]
}

export type CoachHomePlanningResult =
  | { status: PlanningReadStatus }
  | {
      status: 'ready'
      planCount: number
      plans: {
        id: string
        groupId: string
        title: string
        status: string
        sourceGroupTrainingPlanId: string | null
        weeks: {
          id: string
          weekNumber: number
          startDate: string
          endDate: string
          type: string
          targetVolumeKm: number | null
          relative: 'past' | 'current' | 'future'
        }[]
      }[]
    }

const MAX_PLANS = 12
const MAX_WEEKS_PER_PLAN = 3

export function projectCoachHomePlanning<TPlan extends SourcePlan>(
  result: { status: PlanningReadStatus } | { status: 'ready'; plans: readonly TPlan[] },
  onDate: string,
): CoachHomePlanningResult {
  if (result.status !== 'ready') return { status: result.status }
  if (result.plans.length === 0) return { status: 'empty' }

  const plans = [...result.plans].sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, MAX_PLANS).map((plan) => {
      const allWeeks = plan.macrocycles.filter((macro) => !macro.isDeleted)
        .flatMap((macro) => macro.mesocycles.filter((meso) => !meso.isDeleted)
          .flatMap((meso) => meso.microcycles.filter((week) => !week.isDeleted)))
        .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))
      // Retain the closest previous, current and next periods, not a fabricated
      // global current Plan. Every row retains its own authorized Plan identity.
      const past = allWeeks.filter((week) => week.endDate < onDate).slice(-1)
      const current = allWeeks.filter((week) => week.startDate <= onDate && onDate <= week.endDate)
      const future = allWeeks.filter((week) => week.startDate > onDate).slice(0, 1)
      const weeks = [...past, ...current, ...future].slice(0, MAX_WEEKS_PER_PLAN)
        .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))
        .map((week) => ({
          id: week.id,
          weekNumber: week.weekNumber,
          startDate: week.startDate,
          endDate: week.endDate,
          type: week.type,
          targetVolumeKm: week.targetVolumeKm,
          relative: (week.endDate < onDate ? 'past' : week.startDate > onDate ? 'future' : 'current') as 'past' | 'current' | 'future',
        }))
      return {
        id: plan.id,
        groupId: plan.groupId,
        title: plan.title,
        status: plan.status,
        sourceGroupTrainingPlanId: plan.sourceGroupTrainingPlanId,
        weeks,
      }
    })
  return { status: 'ready', planCount: result.plans.length, plans }
}
