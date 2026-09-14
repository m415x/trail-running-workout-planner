'use server'

import { getAthletePlanRealComparisonAction } from '@/app/actions/realized-training-actions'
import { deriveAthleteAdherence } from '@/lib/adherence/athlete-adherence'
import { deriveAthleteAdherenceTrend } from '@/lib/adherence/adherence-trend'
import type { PlanRealComparisonWindow } from '@/types'

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
  if (windows.length === 0) return { success: false as const, data: null }

  const comparisons = await Promise.all(
    windows.map(window => getAthletePlanRealComparisonAction(athleteId, window)),
  )
  if (comparisons.some(result => !result.success || !result.data)) {
    return { success: false as const, data: null }
  }

  const adherenceWindows = comparisons.map(result => deriveAthleteAdherence(result.data!))
  return {
    success: true as const,
    data: deriveAthleteAdherenceTrend(adherenceWindows),
  }
}
