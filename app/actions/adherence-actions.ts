'use server'

import { getAthletePlanRealComparisonAction } from '@/app/actions/realized-training-actions'
import { deriveAthleteAdherence } from '@/lib/adherence/athlete-adherence'
import { deriveAthleteAdherenceTrend } from '@/lib/adherence/adherence-trend'
import type {
  AthletePlanRealComparison,
  PlanRealComparisonWindow,
} from '@/types'

function formatISODate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function weeklyWindows(anchorDate: string, count: number): PlanRealComparisonWindow[] {
  const anchor = new Date(`${anchorDate}T00:00:00Z`)
  if (Number.isNaN(anchor.getTime()) || count < 1) return []

  const mondayOffset = (anchor.getUTCDay() + 6) % 7
  const currentMonday = new Date(anchor)
  currentMonday.setUTCDate(anchor.getUTCDate() - mondayOffset)

  return Array.from({ length: count }, (_, index) => {
    const weeksBack = count - 1 - index
    const start = new Date(currentMonday)
    start.setUTCDate(currentMonday.getUTCDate() - (weeksBack * 7))
    const end = new Date(start)
    end.setUTCDate(start.getUTCDate() + 6)
    return {
      kind: 'week' as const,
      startDate: formatISODate(start),
      endDate: formatISODate(end),
    }
  })
}

function sliceComparison(
  comparison: AthletePlanRealComparison,
  window: PlanRealComparisonWindow,
): AthletePlanRealComparison {
  return {
    teamId: comparison.teamId,
    athleteId: comparison.athleteId,
    window,
    items: comparison.items.filter(item => (
      item.date >= window.startDate && item.date <= window.endDate
    )),
    planningLimitations: comparison.planningLimitations.filter(limitation => (
      limitation.date >= window.startDate && limitation.date <= window.endDate
    )),
  }
}

export async function getAthleteAdherenceAction(
  athleteId: string,
  window: PlanRealComparisonWindow,
) {
  const comparison = await getAthletePlanRealComparisonAction(athleteId, window)
  if (!comparison.success || !comparison.data) {
    return { success: false as const, data: null }
  }

  return {
    success: true as const,
    data: deriveAthleteAdherence(comparison.data),
  }
}

export async function getAthleteAdherenceTrendAction(
  athleteId: string,
  anchorDate: string,
  numberOfWeeks = 4,
) {
  const windows = weeklyWindows(anchorDate, numberOfWeeks)
  const first = windows[0]
  const last = windows[windows.length - 1]
  if (!first || !last) return { success: false as const, data: null }

  const longitudinalWindow: PlanRealComparisonWindow = {
    kind: 'month',
    startDate: first.startDate,
    endDate: last.endDate,
  }
  const comparisonResult = await getAthletePlanRealComparisonAction(athleteId, longitudinalWindow)
  if (!comparisonResult.success || !comparisonResult.data) {
    return { success: false as const, data: null }
  }
  const longitudinalComparison = comparisonResult.data

  const adherenceWindows = windows.map(window => (
    deriveAthleteAdherence(sliceComparison(longitudinalComparison, window))
  ))

  return {
    success: true as const,
    data: deriveAthleteAdherenceTrend(adherenceWindows),
  }
}
