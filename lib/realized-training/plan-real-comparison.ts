import { hasAuthoritativeSessionLink } from '@/lib/readiness/realized-training'
import type {
  PlanRealMetricComparison,
  TrainingComparisonMetricName,
  PlanRealMetricOperand,
  PlanRealMetricUnit,
  PlanRealPlanningContext,
  PlannedSessionComparison,
  RealizedMetric,
  RealizedTrainingRecord,
  UnplannedRealizedComparison,
} from '@/types'

export interface PlannedSessionComparisonInput {
  readonly teamId: string
  readonly athleteId: string
  readonly date: string
  readonly sessionId: string
  readonly sessionTitle: string
  readonly planning: PlanRealPlanningContext
  readonly metrics: Readonly<Record<TrainingComparisonMetricName, PlanRealMetricOperand>>
}

function realizedNumericOperand(
  metric: RealizedMetric,
  unit: PlanRealMetricUnit,
): PlanRealMetricOperand {
  return metric.state === 'known'
    ? { state: 'known', value: metric.value, unit }
    : { state: 'unknown', reason: metric.reason, unit }
}

function realizedOperand(
  record: RealizedTrainingRecord,
  name: TrainingComparisonMetricName,
): PlanRealMetricOperand {
  if (name === 'distanceKm') return realizedNumericOperand(record.metrics.distanceKm, 'km')
  if (name === 'durationMin') return realizedNumericOperand(record.metrics.durationMin, 'min')
  if (name === 'elevationGainM') return realizedNumericOperand(record.metrics.elevationGainM, 'm')

  if (record.metrics.rpe.state === 'known') {
    return { state: 'known', value: record.metrics.rpe.value, unit: 'rpe' }
  }
  if (record.metrics.avgHrBpm.state === 'known') {
    return { state: 'known', value: record.metrics.avgHrBpm.value, unit: 'bpm' }
  }

  return {
    state: 'unknown',
    reason: record.metrics.rpe.reason,
    unit: 'rpe',
  }
}

function notEvaluatedMetric(
  name: TrainingComparisonMetricName,
  planned: PlanRealMetricOperand,
  realized: PlanRealMetricOperand,
  reason: Extract<
    PlanRealMetricComparison['evaluation'],
    { state: 'not_evaluated' }
  >['reason'],
): PlanRealMetricComparison {
  return {
    name,
    evaluation: {
      state: 'not_evaluated',
      planned,
      realized,
      absoluteDelta: null,
      relativeDeltaPercent: null,
      reason,
    },
  }
}

function compareMetric(
  name: TrainingComparisonMetricName,
  planned: PlanRealMetricOperand,
  realized: PlanRealMetricOperand,
): PlanRealMetricComparison {
  if (planned.state === 'unknown') {
    return notEvaluatedMetric(name, planned, realized, planned.reason)
  }
  if (realized.state === 'unknown') {
    return notEvaluatedMetric(name, planned, realized, realized.reason)
  }
  if (planned.unit !== realized.unit) {
    return notEvaluatedMetric(
      name,
      planned,
      realized,
      name === 'intensity' ? 'unsupported_intensity_pair' : 'incompatible_units',
    )
  }

  const bothNumeric = typeof planned.value === 'number' && typeof realized.value === 'number'
  const absoluteDelta = bothNumeric ? realized.value - planned.value : null
  const relativeDeltaPercent = bothNumeric && planned.value !== 0
    ? (absoluteDelta! / planned.value) * 100
    : null
  const matches = planned.value === realized.value

  return {
    name,
    evaluation: {
      state: matches ? 'matched' : 'deviation',
      planned,
      realized,
      absoluteDelta,
      relativeDeltaPercent,
    },
  }
}

function realizedContext(record: RealizedTrainingRecord) {
  return {
    recordId: record.id,
    provenance: record.provenance,
    quality: record.quality,
    limitations: record.limitations,
  } as const
}

function unavailableMetrics(
  planned: PlannedSessionComparisonInput['metrics'],
  reason: 'not_observed' | 'no_authoritative_session_link' | 'known_not_completed',
): readonly PlanRealMetricComparison[] {
  return (Object.keys(planned) as TrainingComparisonMetricName[]).map(name => {
    const operand = planned[name]
    return notEvaluatedMetric(
      name,
      operand,
      { state: 'unknown', reason, unit: operand.unit },
      reason,
    )
  })
}

/**
 * Compares one prescribed session with at most one explicitly linked realized
 * record. Missing or invalid linkage remains unknown; an explicit missed record
 * is the only source of `known_not_completed`.
 */
export function comparePlannedSession(
  planned: PlannedSessionComparisonInput,
  record: RealizedTrainingRecord | null,
): PlannedSessionComparison {
  if (record === null) {
    return {
      kind: 'planned_session',
      state: 'unknown',
      teamId: planned.teamId,
      athleteId: planned.athleteId,
      date: planned.date,
      sessionId: planned.sessionId,
      sessionTitle: planned.sessionTitle,
      planning: planned.planning,
      realized: null,
      metrics: unavailableMetrics(planned.metrics, 'not_observed'),
      limitations: ['no_realized_evidence'],
    }
  }

  const ownedAndLinked = record.teamId === planned.teamId
    && record.athleteId === planned.athleteId
    && record.sessionId === planned.sessionId
    && hasAuthoritativeSessionLink(record)

  if (!ownedAndLinked) {
    return {
      kind: 'planned_session',
      state: 'unknown',
      teamId: planned.teamId,
      athleteId: planned.athleteId,
      date: planned.date,
      sessionId: planned.sessionId,
      sessionTitle: planned.sessionTitle,
      planning: planned.planning,
      realized: realizedContext(record),
      metrics: unavailableMetrics(planned.metrics, 'no_authoritative_session_link'),
      limitations: ['invalid_or_cross_scope_session_link'],
    }
  }

  if (record.status === 'missed') {
    return {
      kind: 'planned_session',
      state: 'known_not_completed',
      teamId: planned.teamId,
      athleteId: planned.athleteId,
      date: planned.date,
      sessionId: planned.sessionId,
      sessionTitle: planned.sessionTitle,
      planning: planned.planning,
      realized: realizedContext(record),
      metrics: unavailableMetrics(planned.metrics, 'known_not_completed'),
      limitations: record.limitations,
    }
  }

  if (record.status !== 'completed' && record.status !== 'partial') {
    return {
      kind: 'planned_session',
      state: 'unknown',
      teamId: planned.teamId,
      athleteId: planned.athleteId,
      date: planned.date,
      sessionId: planned.sessionId,
      sessionTitle: planned.sessionTitle,
      planning: planned.planning,
      realized: realizedContext(record),
      metrics: unavailableMetrics(planned.metrics, 'not_observed'),
      limitations: [...record.limitations, 'non_performed_realized_status'],
    }
  }

  const metrics = (Object.keys(planned.metrics) as TrainingComparisonMetricName[])
    .map(name => compareMetric(name, planned.metrics[name], realizedOperand(record, name)))
  const evaluated = metrics.filter(metric => metric.evaluation.state !== 'not_evaluated')
  const state = evaluated.length === 0
    ? 'unknown'
    : evaluated.some(metric => metric.evaluation.state === 'deviation')
      ? 'deviation'
      : 'matched'

  return {
    kind: 'planned_session',
    state,
    teamId: planned.teamId,
    athleteId: planned.athleteId,
    date: planned.date,
    sessionId: planned.sessionId,
    sessionTitle: planned.sessionTitle,
    planning: planned.planning,
    realized: realizedContext(record),
    metrics,
    limitations: record.limitations,
  }
}

/**
 * Projects a free realized record without attempting any heuristic match.
 * Metrics remain visible as observed operands but are intentionally not
 * evaluated against a fabricated plan baseline.
 */
export function projectUnplannedRealized(
  record: RealizedTrainingRecord,
): UnplannedRealizedComparison {
  const names: readonly TrainingComparisonMetricName[] = [
    'distanceKm',
    'durationMin',
    'elevationGainM',
    'intensity',
  ]
  const metrics = names.map(name => {
    const realized = realizedOperand(record, name)
    return notEvaluatedMetric(
      name,
      { state: 'unknown', reason: 'not_prescribed', unit: realized.unit },
      realized,
      'no_authoritative_session_link',
    )
  })

  return {
    kind: 'unplanned_realized',
    state: 'unplanned_realized',
    teamId: record.teamId,
    athleteId: record.athleteId,
    date: record.date,
    realized: realizedContext(record),
    metrics,
    limitations: [...record.limitations, 'unplanned_realized'],
  }
}
