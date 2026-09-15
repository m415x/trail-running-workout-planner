import type { TrainingLoadTrendPoint } from '@/types/training/training-load.types'

/**
 * Copies the already-derived KAN-344 load trend for descriptive athlete detail.
 * This boundary intentionally performs no new load calculation or interpretation.
 */
export function projectLoadDetailTrend(
  trend: readonly TrainingLoadTrendPoint[],
): readonly TrainingLoadTrendPoint[] {
  return trend.map(point => ({ ...point }))
}
