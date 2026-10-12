import { shiftAthletePlanWeek } from './plan-week-navigation'

type PlannedMetric =
  | { status: 'complete'; value: number }
  | { status: 'incomplete' | 'unknown'; value: null }

interface WeeklyPlanEvidence {
  monday: string
  distance: PlannedMetric
  elevationGain: PlannedMetric
}

interface EffectivePlanningPeriod {
  id: string
  startDate: string
  endDate: string
}

type PlanOverview =
  | { status: 'error' }
  | {
      status: 'loaded'
      period: { source: 'planning' | 'window'; startDate: string; endDate: string }
      weeks: WeeklyPlanEvidence[]
    }

/**
 * Presentation projection over already-authorized, effective weekly evidence.
 * A planning period is named only when exactly one period contains the selected
 * week. Ambiguous hierarchy affects the heading, not the week data itself.
 */
export function buildAthletePlanOverview(input: {
  selectedMonday: string
  effectivePeriods: readonly EffectivePlanningPeriod[]
  weeks: readonly WeeklyPlanEvidence[]
}): PlanOverview {
  let followingMonday: string
  try {
    followingMonday = shiftAthletePlanWeek(input.selectedMonday, 1)
  } catch {
    return { status: 'error' }
  }

  const unique = new Set<string>()
  for (const week of input.weeks) {
    if (unique.has(week.monday)) return { status: 'error' }
    unique.add(week.monday)
  }

  const applicable = input.effectivePeriods.filter(
    period => period.startDate <= input.selectedMonday && period.endDate >= input.selectedMonday,
  )

  const period: {
    source: 'planning' | 'window'
    startDate: string
    endDate: string
  } = applicable.length === 1
    ? { source: 'planning', startDate: applicable[0].startDate, endDate: applicable[0].endDate }
    : {
        source: 'window',
        startDate: input.weeks[0]?.monday ?? input.selectedMonday,
        endDate: input.weeks.length
          ? (() => {
              const last = input.weeks[input.weeks.length - 1].monday
              const next = shiftAthletePlanWeek(last, 1)
              const date = new Date(`${next}T00:00:00.000Z`)
              date.setUTCDate(date.getUTCDate() - 1)
              return date.toISOString().slice(0, 10)
            })()
          : (() => {
              const date = new Date(`${followingMonday}T00:00:00.000Z`)
              date.setUTCDate(date.getUTCDate() - 1)
              return date.toISOString().slice(0, 10)
            })(),
      }

  return { status: 'loaded', period, weeks: [...input.weeks] }
}
