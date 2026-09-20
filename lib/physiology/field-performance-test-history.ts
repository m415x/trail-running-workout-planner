import type {
  FieldPerformanceTestExecutionContext,
  FieldPerformanceTestProtocol,
  FieldPerformanceTestRecordedBy,
  FieldPerformanceTestReviewStatus,
  FieldPerformanceTestSource,
} from '@/lib/physiology/field-performance-test'

export interface FieldPerformanceTestRow {
  id: string
  athleteId: string
  performedAt: string
  protocol: FieldPerformanceTestProtocol
  source: FieldPerformanceTestSource
  testEventId?: string | null
  executionContext?: FieldPerformanceTestExecutionContext
  recordedBy?: FieldPerformanceTestRecordedBy
  reviewStatus?: FieldPerformanceTestReviewStatus
  isEligible?: boolean
  distanceM: 1000
  elapsedTimeSec: number
  notes: string | null
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Models append-only history semantics independently from the storage adapter.
 * Persistence must insert the new evidence row rather than upserting by athlete/date.
 */
export function appendFieldPerformanceTest(
  history: readonly FieldPerformanceTestRow[],
  evaluation: FieldPerformanceTestRow,
): FieldPerformanceTestRow[] {
  return [...history, evaluation]
}

/**
 * Returns active evidence for one athlete in chronological order.
 * Invalidated rows remain durable evidence but are excluded from the default view.
 */
export function listFieldPerformanceTestHistory(
  rows: readonly FieldPerformanceTestRow[],
  athleteId: string,
): FieldPerformanceTestRow[] {
  return rows
    .filter((row) => row.athleteId === athleteId && !row.isDeleted)
    .toSorted((left, right) => {
      const dateOrder = left.performedAt.localeCompare(right.performedAt)
      if (dateOrder !== 0) return dateOrder

      const createdOrder = left.createdAt.localeCompare(right.createdAt)
      if (createdOrder !== 0) return createdOrder

      return left.id.localeCompare(right.id)
    })
}

/**
 * Invalidates evidence without mutating or erasing its observed values.
 * A corrected observation is represented by a separate appended row.
 */
export function invalidateFieldPerformanceTest(
  evaluation: FieldPerformanceTestRow,
  updatedAt: string,
): FieldPerformanceTestRow {
  return {
    ...evaluation,
    isDeleted: true,
    updatedAt,
  }
}


/**
 * Returns active evidence for one athlete that is temporally applicable to an
 * effective date. Ordering matches the canonical history order so callers can
 * deterministically select the last eligible observation.
 */
export function listEligibleFieldPerformanceTestHistory(
  rows: readonly FieldPerformanceTestRow[],
  athleteId: string,
  effectiveDate: string,
): FieldPerformanceTestRow[] {
  return listFieldPerformanceTestHistory(rows, athleteId).filter(
    (row) =>
      row.performedAt <= effectiveDate &&
      // Rows written before the KAN-401 lifecycle contract are accepted
      // evidence by construction. New lifecycle-aware rows must opt in
      // explicitly through review eligibility.
      (row.isEligible ?? true),
  )
}
