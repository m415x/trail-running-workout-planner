import type { RealizedTrainingRecord } from '@/types/training/readiness.types'

export interface RealizedTrainingSeriesPoint {
  readonly date: string
  readonly sessions: number
  readonly distanceKm: number | null
  readonly durationMin: number | null
  readonly elevationGainM: number | null
}

type MetricName = 'distanceKm' | 'durationMin' | 'elevationGainM'

type MutableSeriesPoint = {
  date: string
  sessions: number
  sums: Record<MetricName, number>
  known: Record<MetricName, number>
}

const METRIC_NAMES: readonly MetricName[] = [
  'distanceKm',
  'durationMin',
  'elevationGainM',
]

/**
 * Projects genuine realized-training evidence into a date series.
 * Missing dates are not invented, and unknown metric evidence remains null.
 */
export function projectRealizedTrainingSeries(
  records: readonly RealizedTrainingRecord[],
): RealizedTrainingSeriesPoint[] {
  const byDate = new Map<string, MutableSeriesPoint>()

  for (const record of records) {
    let point = byDate.get(record.date)
    if (!point) {
      point = {
        date: record.date,
        sessions: 0,
        sums: { distanceKm: 0, durationMin: 0, elevationGainM: 0 },
        known: { distanceKm: 0, durationMin: 0, elevationGainM: 0 },
      }
      byDate.set(record.date, point)
    }

    point.sessions += 1

    for (const metricName of METRIC_NAMES) {
      const metric = record.metrics[metricName]
      if (metric.state === 'known') {
        point.sums[metricName] += metric.value
        point.known[metricName] += 1
      }
    }
  }

  return [...byDate.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map(point => ({
      date: point.date,
      sessions: point.sessions,
      distanceKm: point.known.distanceKm > 0 ? point.sums.distanceKm : null,
      durationMin: point.known.durationMin > 0 ? point.sums.durationMin : null,
      elevationGainM: point.known.elevationGainM > 0 ? point.sums.elevationGainM : null,
    }))
}
