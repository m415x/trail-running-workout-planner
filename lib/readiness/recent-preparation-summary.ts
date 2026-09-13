import {
  evaluateReadinessDataSufficiency,
  isMetricCoverageSufficient,
} from '@/lib/readiness/data-sufficiency'
import type {
  PreparationSummaryUnit,
  PreparationSummaryValue,
  ReadinessDataSufficiencyPolicy,
  RealizedMetricName,
  RealizedTrainingRecord,
  RecentPreparationSummary,
} from '@/types/training/readiness.types'

function performed(record: RealizedTrainingRecord): boolean {
  return record.status === 'completed' || record.status === 'partial'
}

function inWindow(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate
}

function unknown(
  unit: PreparationSummaryUnit,
  sampleSize: number,
  coverageRatio: number,
  reason: 'insufficient_data' | 'insufficient_metric_coverage',
): PreparationSummaryValue {
  return { state: 'unknown', unit, sampleSize, coverageRatio, reason }
}

function known(
  value: number,
  unit: PreparationSummaryUnit,
  sampleSize: number,
  coverageRatio: number,
): PreparationSummaryValue {
  return { state: 'known', value, unit, sampleSize, coverageRatio }
}

function valuesFor(
  records: readonly RealizedTrainingRecord[],
  metric: RealizedMetricName,
): number[] {
  return records.flatMap((record) => {
    const value = record.metrics[metric]
    return value.state === 'known' ? [value.value] : []
  })
}

function sumMetric(input: {
  records: readonly RealizedTrainingRecord[]
  metric: RealizedMetricName
  unit: PreparationSummaryUnit
  sufficient: boolean
  dataSufficient: boolean
  coverageRatio: number
}): PreparationSummaryValue {
  const values = valuesFor(input.records, input.metric)
  if (!input.dataSufficient) {
    return unknown(input.unit, values.length, input.coverageRatio, 'insufficient_data')
  }
  if (!input.sufficient) {
    return unknown(input.unit, values.length, input.coverageRatio, 'insufficient_metric_coverage')
  }
  return known(values.reduce((sum, value) => sum + value, 0), input.unit, values.length, input.coverageRatio)
}

function averageMetric(input: {
  records: readonly RealizedTrainingRecord[]
  metric: RealizedMetricName
  unit: PreparationSummaryUnit
  sufficient: boolean
  dataSufficient: boolean
  coverageRatio: number
}): PreparationSummaryValue {
  const values = valuesFor(input.records, input.metric)
  if (!input.dataSufficient) {
    return unknown(input.unit, values.length, input.coverageRatio, 'insufficient_data')
  }
  if (!input.sufficient || values.length === 0) {
    return unknown(input.unit, values.length, input.coverageRatio, 'insufficient_metric_coverage')
  }
  return known(
    values.reduce((sum, value) => sum + value, 0) / values.length,
    input.unit,
    values.length,
    input.coverageRatio,
  )
}

function maxMetric(input: {
  records: readonly RealizedTrainingRecord[]
  metric: RealizedMetricName
  unit: PreparationSummaryUnit
  sufficient: boolean
  dataSufficient: boolean
  coverageRatio: number
}): PreparationSummaryValue {
  const values = valuesFor(input.records, input.metric)
  if (!input.dataSufficient) {
    return unknown(input.unit, values.length, input.coverageRatio, 'insufficient_data')
  }
  if (!input.sufficient || values.length === 0) {
    return unknown(input.unit, values.length, input.coverageRatio, 'insufficient_metric_coverage')
  }
  return known(Math.max(...values), input.unit, values.length, input.coverageRatio)
}

function perWeek(
  total: PreparationSummaryValue,
  windowDays: number,
  unit: 'km_per_week' | 'min_per_week' | 'm_per_week',
): PreparationSummaryValue {
  if (total.state === 'unknown') return { ...total, unit }
  const weeks = windowDays / 7
  return known(total.value / weeks, unit, total.sampleSize, total.coverageRatio)
}

export function buildRecentPreparationSummary(input: {
  readonly records: readonly RealizedTrainingRecord[]
  readonly teamId: string
  readonly athleteId: string
  readonly endDate: string
  readonly policy: ReadinessDataSufficiencyPolicy
}): RecentPreparationSummary {
  const sufficiency = evaluateReadinessDataSufficiency(input)
  const { coverage } = sufficiency
  const scoped = input.records.filter((record) => (
    record.teamId === input.teamId
    && record.athleteId === input.athleteId
    && performed(record)
    && inWindow(record.date, coverage.window.startDate, coverage.window.endDate)
  ))
  const dataSufficient = sufficiency.status === 'sufficient'

  const volumeTotal = sumMetric({
    records: scoped,
    metric: 'distanceKm',
    unit: 'km',
    sufficient: isMetricCoverageSufficient(coverage, 'distanceKm'),
    dataSufficient,
    coverageRatio: coverage.metrics.distanceKm.ratio,
  })
  const durationTotal = sumMetric({
    records: scoped,
    metric: 'durationMin',
    unit: 'min',
    sufficient: isMetricCoverageSufficient(coverage, 'durationMin'),
    dataSufficient,
    coverageRatio: coverage.metrics.durationMin.ratio,
  })
  const elevationTotal = sumMetric({
    records: scoped,
    metric: 'elevationGainM',
    unit: 'm',
    sufficient: isMetricCoverageSufficient(coverage, 'elevationGainM'),
    dataSufficient,
    coverageRatio: coverage.metrics.elevationGainM.ratio,
  })

  const sessionCoverageRatio = dataSufficient ? 1 : 0
  const frequency = dataSufficient
    ? known(scoped.length / (coverage.window.windowDays / 7), 'sessions_per_week', scoped.length, sessionCoverageRatio)
    : unknown('sessions_per_week', scoped.length, sessionCoverageRatio, 'insufficient_data')

  const continuity = dataSufficient
    ? known(
        coverage.totalBuckets === 0 ? 0 : coverage.activeBuckets / coverage.totalBuckets,
        'ratio',
        coverage.activeBuckets,
        1,
      )
    : unknown('ratio', coverage.activeBuckets, 0, 'insufficient_data')

  const limitations = new Set<string>()
  for (const record of scoped) {
    for (const limitation of record.limitations) limitations.add(limitation)
  }
  if (!dataSufficient) limitations.add('insufficient_overall_data')
  for (const metric of ['distanceKm', 'durationMin', 'elevationGainM', 'avgHrBpm', 'rpe'] as const) {
    if (!isMetricCoverageSufficient(coverage, metric)) limitations.add(`insufficient_${metric}_coverage`)
  }

  return {
    teamId: input.teamId,
    athleteId: input.athleteId,
    window: coverage.window,
    dataStatus: sufficiency.status,
    performedRecords: scoped.length,
    volume: {
      totalKm: volumeTotal,
      averageWeeklyKm: perWeek(volumeTotal, coverage.window.windowDays, 'km_per_week'),
    },
    duration: {
      totalMin: durationTotal,
      averageWeeklyMin: perWeek(durationTotal, coverage.window.windowDays, 'min_per_week'),
    },
    elevation: {
      totalGainM: elevationTotal,
      averageWeeklyGainM: perWeek(elevationTotal, coverage.window.windowDays, 'm_per_week'),
    },
    frequency: { recordedSessionsPerWeek: frequency },
    intensity: {
      averageRpe: averageMetric({
        records: scoped,
        metric: 'rpe',
        unit: 'rpe',
        sufficient: isMetricCoverageSufficient(coverage, 'rpe'),
        dataSufficient,
        coverageRatio: coverage.metrics.rpe.ratio,
      }),
      averageHrBpm: averageMetric({
        records: scoped,
        metric: 'avgHrBpm',
        unit: 'bpm',
        sufficient: isMetricCoverageSufficient(coverage, 'avgHrBpm'),
        dataSufficient,
        coverageRatio: coverage.metrics.avgHrBpm.ratio,
      }),
    },
    longRun: {
      longestDistanceKm: maxMetric({
        records: scoped,
        metric: 'distanceKm',
        unit: 'km',
        sufficient: isMetricCoverageSufficient(coverage, 'distanceKm'),
        dataSufficient,
        coverageRatio: coverage.metrics.distanceKm.ratio,
      }),
      longestDurationMin: maxMetric({
        records: scoped,
        metric: 'durationMin',
        unit: 'min',
        sufficient: isMetricCoverageSufficient(coverage, 'durationMin'),
        dataSufficient,
        coverageRatio: coverage.metrics.durationMin.ratio,
      }),
      peakElevationGainM: maxMetric({
        records: scoped,
        metric: 'elevationGainM',
        unit: 'm',
        sufficient: isMetricCoverageSufficient(coverage, 'elevationGainM'),
        dataSufficient,
        coverageRatio: coverage.metrics.elevationGainM.ratio,
      }),
    },
    continuity: {
      activeBucketRatio: continuity,
      activeBuckets: coverage.activeBuckets,
      totalBuckets: coverage.totalBuckets,
    },
    limitations: [...limitations],
  }
}
