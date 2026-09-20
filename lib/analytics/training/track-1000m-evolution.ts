import {
  deriveTrack1000mPerformance,
  type FieldPerformanceTestProtocol,
} from '@/lib/physiology/field-performance-test'
import {
  listFieldPerformanceTestHistory,
  type FieldPerformanceTestRow,
} from '@/lib/physiology/field-performance-test-history'

export interface Track1000mEvolutionPoint {
  readonly evaluationId: string
  readonly performedAt: string
  readonly protocol: FieldPerformanceTestProtocol
  readonly elapsedTimeSec: number
  readonly paceSecPerKm: number
  readonly averageSpeedKmh: number
}

/**
 * Projects canonical active 1000 m field-test evidence into a factual,
 * consumer-neutral evolution series. Ordering and invalidation semantics remain
 * owned by the field-test history boundary; derived values are arithmetic only.
 */
export function projectTrack1000mEvolutionSeries(
  rows: readonly FieldPerformanceTestRow[],
  athleteId: string,
): Track1000mEvolutionPoint[] {
  return listFieldPerformanceTestHistory(rows, athleteId).map(evaluation => {
    const performance = deriveTrack1000mPerformance(evaluation)

    return {
      evaluationId: evaluation.id,
      performedAt: evaluation.performedAt,
      protocol: evaluation.protocol,
      elapsedTimeSec: evaluation.elapsedTimeSec,
      paceSecPerKm: performance.paceSecPerKm,
      averageSpeedKmh: performance.averageSpeedKmh,
    }
  })
}
