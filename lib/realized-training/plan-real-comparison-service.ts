import { hasAuthoritativeSessionLink } from '@/lib/readiness/realized-training'
import {
  comparePlannedSession,
  projectUnplannedRealized,
  type PlannedSessionComparisonInput,
} from '@/lib/realized-training/plan-real-comparison'
import type {
  AthletePlanRealComparison,
  PlanRealComparisonItem,
  PlanRealComparisonWindow,
  PlanRealPlanningResolutionLimitation,
  RealizedTrainingRecord,
} from '@/types'

export interface BuildAthletePlanRealComparisonInput {
  readonly teamId: string
  readonly athleteId: string
  readonly window: PlanRealComparisonWindow
  readonly plannedSessions: readonly PlannedSessionComparisonInput[]
  readonly realizedRecords: readonly RealizedTrainingRecord[]
  readonly planningLimitations?: readonly PlanRealPlanningResolutionLimitation[]
}

function inWindow(date: string, window: PlanRealComparisonWindow) {
  return date >= window.startDate && date <= window.endDate
}

function assertWindow(window: PlanRealComparisonWindow) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/
  if (
    !datePattern.test(window.startDate)
    || !datePattern.test(window.endDate)
    || window.startDate > window.endDate
  ) {
    throw new RangeError('Plan-real comparison requires an ordered ISO date window.')
  }
}

function itemOrder(first: PlanRealComparisonItem, second: PlanRealComparisonItem) {
  const dateOrder = first.date.localeCompare(second.date)
  if (dateOrder !== 0) return dateOrder
  if (first.kind !== second.kind) return first.kind === 'planned_session' ? -1 : 1

  const firstId = first.kind === 'planned_session'
    ? first.sessionId
    : first.realized.recordId
  const secondId = second.kind === 'planned_session'
    ? second.sessionId
    : second.realized.recordId
  return firstId.localeCompare(secondId)
}

/**
 * Builds a deterministic, read-only longitudinal comparison from already scoped
 * planning and realized evidence.
 *
 * The service never guesses among multiple authoritative realized rows for one
 * session. Such data remains unknown until the ambiguity is resolved. Free
 * records are preserved independently and never matched by date or metrics.
 */
export function buildAthletePlanRealComparison(
  input: BuildAthletePlanRealComparisonInput,
): AthletePlanRealComparison {
  assertWindow(input.window)

  const plannedSessions = input.plannedSessions.filter(session => (
    session.teamId === input.teamId
    && session.athleteId === input.athleteId
    && inWindow(session.date, input.window)
  ))
  const realizedRecords = input.realizedRecords.filter(record => (
    record.teamId === input.teamId
    && record.athleteId === input.athleteId
    && inWindow(record.date, input.window)
  ))

  const plannedItems = plannedSessions.map(session => {
    const linkedRecords = realizedRecords.filter(record => (
      record.sessionId === session.sessionId
      && hasAuthoritativeSessionLink(record)
    ))

    if (linkedRecords.length <= 1) {
      return comparePlannedSession(session, linkedRecords[0] ?? null)
    }

    const unresolved = comparePlannedSession(session, null)
    return {
      ...unresolved,
      limitations: [
        ...unresolved.limitations,
        'multiple_authoritative_realized_records',
        ...linkedRecords.map(record => `conflicting_record:${record.id}`),
      ],
    }
  })

  const unplannedItems = realizedRecords
    .filter(record => record.sessionId === null)
    .map(projectUnplannedRealized)

  return {
    teamId: input.teamId,
    athleteId: input.athleteId,
    window: input.window,
    items: [...plannedItems, ...unplannedItems].sort(itemOrder),
    planningLimitations: input.planningLimitations ?? [],
  }
}
