import { buildSystematicVolumePlanningContext } from '@/lib/systematic-volume/systematic-volume-context'
import type {
  AthletePlanRealComparison,
  CompetitionImpactWindowResolution,
  Microcycle,
  PlanRealComparisonItem,
  PlanRealMetricComparison,
  SystematicVolumeCoverage,
  SystematicVolumeDimension,
  SystematicVolumeInsufficientReason,
  SystematicVolumeMicrocycleEvidence,
} from '@/types'
import { SYSTEMATIC_VOLUME_RULE_CONFIG } from '@/types/training/systematic-volume-excess.types'

function metricFor(
  item: PlanRealComparisonItem,
  dimension: SystematicVolumeDimension,
): PlanRealMetricComparison | null {
  return item.metrics.find(metric => metric.name === dimension) ?? null
}

function knownNumber(
  metric: PlanRealMetricComparison | null,
  side: 'planned' | 'realized',
): number | null {
  if (!metric) return null
  const operand = metric.evaluation[side]
  return operand.state === 'known' && typeof operand.value === 'number' ? operand.value : null
}

function inMicrocycle(item: PlanRealComparisonItem, microcycle: Microcycle) {
  return item.date >= microcycle.startDate && item.date <= microcycle.endDate
}

function hasPlanningLimitation(
  comparison: AthletePlanRealComparison,
  microcycle: Microcycle,
) {
  return comparison.planningLimitations.some(limitation => (
    limitation.date >= microcycle.startDate && limitation.date <= microcycle.endDate
  ))
}

function coverageFor(
  plannedSessions: number,
  comparableSessions: number,
  unknownSessions: number,
  unplannedRealizedSessions: number,
): SystematicVolumeCoverage {
  return {
    plannedSessions,
    comparableSessions,
    unknownSessions,
    unplannedRealizedSessions,
    coverageRatio: plannedSessions > 0 ? comparableSessions / plannedSessions : null,
  }
}

export function buildSystematicVolumeMicrocycleEvidence(
  comparison: AthletePlanRealComparison,
  microcycle: Microcycle,
  dimension: SystematicVolumeDimension,
  competitionResolution?: CompetitionImpactWindowResolution | null,
): SystematicVolumeMicrocycleEvidence {
  const items = comparison.items.filter(item => inMicrocycle(item, microcycle))
  const plannedItems = items.filter(item => item.kind === 'planned_session')
  const unplannedItems = items.filter(item => item.kind === 'unplanned_realized')

  let planned = 0
  let realized = 0
  let comparableSessions = 0
  let unknownSessions = 0
  const plannedSessionIds: string[] = []
  const realizedRecordIds = new Set<string>()
  const unplannedRecordIds = new Set<string>()
  const insufficientReasons: SystematicVolumeInsufficientReason[] = []

  for (const item of plannedItems) {
    const metric = metricFor(item, dimension)
    const plannedValue = knownNumber(metric, 'planned')
    const realizedValue = knownNumber(metric, 'realized')

    plannedSessionIds.push(item.sessionId)
    if (item.realized) realizedRecordIds.add(item.realized.recordId)

    if (plannedValue === null) {
      unknownSessions += 1
      insufficientReasons.push('missing_planned_value')
      continue
    }

    planned += plannedValue

    if (realizedValue === null) {
      unknownSessions += 1
      insufficientReasons.push('missing_realized_value')
      continue
    }

    realized += realizedValue
    comparableSessions += 1
  }

  for (const item of unplannedItems) {
    const recordId = item.realized.recordId

    // The authoritative plan-real projection should already prevent this. Keep
    // the guard here so malformed/duplicated projections cannot double-count a
    // realized record as both linked and unplanned evidence.
    if (realizedRecordIds.has(recordId)) continue

    const metric = metricFor(item, dimension)
    const realizedValue = knownNumber(metric, 'realized')
    unplannedRecordIds.add(recordId)
    realizedRecordIds.add(recordId)

    if (realizedValue === null) {
      unknownSessions += 1
      insufficientReasons.push('missing_realized_value')
      continue
    }

    realized += realizedValue
  }

  if (hasPlanningLimitation(comparison, microcycle)) {
    insufficientReasons.push('planning_resolution')
  }

  const coverage = coverageFor(
    plannedItems.length,
    comparableSessions,
    unknownSessions,
    unplannedRecordIds.size,
  )
  const evaluable =
    plannedItems.length > 0
    && comparableSessions === plannedItems.length
    && insufficientReasons.length === 0

  if (!evaluable && !insufficientReasons.includes('planning_resolution')) {
    insufficientReasons.push('insufficient_microcycle_coverage')
  }

  return {
    microcycleId: microcycle.id,
    startDate: microcycle.startDate,
    endDate: microcycle.endDate,
    dimension,
    evaluable,
    magnitude: evaluable
      ? {
          planned,
          realized,
          absoluteDelta: realized - planned,
          relativeDeltaPercent: planned > 0 ? ((realized - planned) / planned) * 100 : null,
        }
      : null,
    coverage,
    context: buildSystematicVolumePlanningContext(microcycle, competitionResolution),
    insufficientReasons: [...new Set(insufficientReasons)],
    contributingPlannedSessionIds: plannedSessionIds,
    contributingRealizedSessionIds: [...realizedRecordIds],
    unplannedRealizedSessionIds: [...unplannedRecordIds],
  }
}

export function buildSystematicVolumeSeries(
  comparison: AthletePlanRealComparison,
  microcycles: readonly Microcycle[],
  competitionResolution?: CompetitionImpactWindowResolution | null,
): readonly SystematicVolumeMicrocycleEvidence[] {
  return [...microcycles]
    .sort((first, second) => first.startDate.localeCompare(second.startDate))
    .flatMap(microcycle => SYSTEMATIC_VOLUME_RULE_CONFIG.dimensions.map(dimension => (
      buildSystematicVolumeMicrocycleEvidence(
        comparison,
        microcycle,
        dimension,
        competitionResolution,
      )
    )))
}
