import { buildIntegralPlanningReviewProvenance } from '@/lib/periodization/planning-review-provenance'
import type {
  IntegralPlanningReview,
  IntegralPlanningReviewSummary,
  PlanningReviewCompetition,
  PlanningReviewMacrocycle,
  PlanningReviewMesocycle,
  PlanningReviewTotals,
  PlanningReviewWeekSummary,
} from '@/types/training/planning-review.types'

const EMPTY_TOTALS: PlanningReviewTotals = {
  targetVolumeKm: 0,
  targetElevationGainM: 0,
  targetDurationMin: 0,
  microcycleCount: 0,
  sessionCount: 0,
  prescriptionCount: 0,
  competitionCount: 0,
}

const COMPETITION_PRIORITY_ORDER = {
  A: 0,
  B: 1,
  C: 2,
} as const

function addTotals(
  first: PlanningReviewTotals,
  second: PlanningReviewTotals,
): PlanningReviewTotals {
  return {
    targetVolumeKm: first.targetVolumeKm + second.targetVolumeKm,
    targetElevationGainM: first.targetElevationGainM + second.targetElevationGainM,
    targetDurationMin: first.targetDurationMin + second.targetDurationMin,
    microcycleCount: first.microcycleCount + second.microcycleCount,
    sessionCount: first.sessionCount + second.sessionCount,
    prescriptionCount: first.prescriptionCount + second.prescriptionCount,
    competitionCount: first.competitionCount + second.competitionCount,
  }
}

function sumTotals(totals: readonly PlanningReviewTotals[]) {
  return totals.reduce(addTotals, EMPTY_TOTALS)
}

function isDateInside(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate
}

function countCompetitionsInRange(
  competitions: readonly PlanningReviewCompetition[],
  startDate: string,
  endDate: string,
) {
  return competitions.filter(({ entry }) => (
    isDateInside(entry.date, startDate, endDate)
  )).length
}

function summarizeWeek(
  microcycle: PlanningReviewMesocycle['microcycles'][number],
  competitions: readonly PlanningReviewCompetition[],
): PlanningReviewWeekSummary {
  return {
    microcycleId: microcycle.microcycle.id,
    weekNumber: microcycle.microcycle.weekNumber,
    startDate: microcycle.microcycle.startDate,
    endDate: microcycle.microcycle.endDate,
    targetVolumeKm: microcycle.targets.targetVolumeKm ?? 0,
    targetElevationGainM: microcycle.targets.targetElevationGainM ?? 0,
    targetDurationMin: microcycle.targets.targetDurationMin ?? 0,
    microcycleCount: 1,
    sessionCount: microcycle.sessions.length,
    prescriptionCount: microcycle.sessions.reduce(
      (total, session) => total + session.prescriptions.length,
      0,
    ),
    competitionCount: countCompetitionsInRange(
      competitions,
      microcycle.microcycle.startDate,
      microcycle.microcycle.endDate,
    ),
  }
}

function summarizeMesocycle(
  node: PlanningReviewMesocycle,
  competitions: readonly PlanningReviewCompetition[],
) {
  const weeks = [...node.microcycles]
    .sort((first, second) => (
      first.microcycle.weekNumber - second.microcycle.weekNumber
      || first.microcycle.startDate.localeCompare(second.microcycle.startDate)
      || first.microcycle.id.localeCompare(second.microcycle.id)
    ))
    .map((microcycle) => summarizeWeek(microcycle, competitions))

  return {
    mesocycleId: node.mesocycle.id,
    totals: sumTotals(weeks),
    weeks,
  }
}

function summarizeMacrocycle(
  node: PlanningReviewMacrocycle,
  competitions: readonly PlanningReviewCompetition[],
) {
  const mesocycles = [...node.mesocycles]
    .sort((first, second) => (
      first.mesocycle.number - second.mesocycle.number
      || first.mesocycle.id.localeCompare(second.mesocycle.id)
    ))
    .map((mesocycle) => summarizeMesocycle(mesocycle, competitions))

  return {
    macrocycleId: node.macrocycle.id,
    totals: sumTotals(mesocycles.map(({ totals }) => totals)),
    mesocycles,
  }
}

function sortCompetitions(
  competitions: readonly PlanningReviewCompetition[],
) {
  return [...competitions].sort((first, second) => (
    first.entry.date.localeCompare(second.entry.date)
    || COMPETITION_PRIORITY_ORDER[first.entry.priority]
      - COMPETITION_PRIORITY_ORDER[second.entry.priority]
    || first.entry.id.localeCompare(second.entry.id)
  ))
}

/**
 * Builds the persistence-agnostic H11 summary consumed by integral review.
 *
 * Targets keep kilometers, positive elevation meters and minutes as separate
 * dimensions. Null targets contribute zero to arithmetic without changing the
 * authoritative values stored in the review aggregate. The input remains
 * untouched and no validation or persistence side effect is performed here.
 */
export function buildIntegralPlanningReviewSummary(
  review: IntegralPlanningReview,
): IntegralPlanningReviewSummary {
  const competitions = sortCompetitions(review.competitions)
  const macrocycles = [...review.macrocycles]
    .sort((first, second) => (
      first.macrocycle.startDate.localeCompare(second.macrocycle.startDate)
      || first.macrocycle.id.localeCompare(second.macrocycle.id)
    ))
    .map((macrocycle) => summarizeMacrocycle(macrocycle, competitions))
  const hierarchyTotals = sumTotals(macrocycles.map(({ totals }) => totals))

  return {
    scope: review.scope,
    totals: {
      ...hierarchyTotals,
      competitionCount: competitions.length,
    },
    macrocycles,
    competitions,
    provenance: buildIntegralPlanningReviewProvenance(review),
  }
}
