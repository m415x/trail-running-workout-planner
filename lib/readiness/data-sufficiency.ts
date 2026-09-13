import type {
  ReadinessAnalysisWindow,
  ReadinessDataCoverage,
  ReadinessDataInsufficiencyReason,
  ReadinessDataSufficiency,
  ReadinessDataSufficiencyPolicy,
  RealizedMetricName,
  RealizedTrainingRecord,
} from '@/types/training/readiness.types'

const DAY_MS = 86_400_000
const METRIC_NAMES: readonly RealizedMetricName[] = [
  'distanceKm',
  'durationMin',
  'elevationGainM',
  'avgHrBpm',
  'rpe',
]

function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error(`Invalid ISO date: ${value}`)

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ISO date: ${value}`)
  }
  return date
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function assertPolicy(policy: ReadinessDataSufficiencyPolicy): void {
  if (!Number.isInteger(policy.lookbackDays) || policy.lookbackDays <= 0) {
    throw new Error('lookbackDays must be a positive integer')
  }
  if (!Number.isInteger(policy.bucketDays) || policy.bucketDays <= 0) {
    throw new Error('bucketDays must be a positive integer')
  }
  if (!Number.isInteger(policy.minimumPerformedSessions) || policy.minimumPerformedSessions < 0) {
    throw new Error('minimumPerformedSessions must be a non-negative integer')
  }
  if (!Number.isInteger(policy.minimumActiveBuckets) || policy.minimumActiveBuckets < 0) {
    throw new Error('minimumActiveBuckets must be a non-negative integer')
  }
  if (
    !Number.isFinite(policy.minimumMetricCoverageRatio)
    || policy.minimumMetricCoverageRatio < 0
    || policy.minimumMetricCoverageRatio > 1
  ) {
    throw new Error('minimumMetricCoverageRatio must be between 0 and 1')
  }
}

export function buildReadinessAnalysisWindow(input: {
  readonly endDate: string
  readonly policy: ReadinessDataSufficiencyPolicy
}): ReadinessAnalysisWindow {
  assertPolicy(input.policy)
  const end = parseIsoDate(input.endDate)
  const start = new Date(end.getTime() - (input.policy.lookbackDays - 1) * DAY_MS)

  return {
    startDate: formatIsoDate(start),
    endDate: input.endDate,
    windowDays: input.policy.lookbackDays,
    bucketDays: input.policy.bucketDays,
  }
}

function isWithinWindow(date: string, window: ReadinessAnalysisWindow): boolean {
  return date >= window.startDate && date <= window.endDate
}

function performed(record: RealizedTrainingRecord): boolean {
  return record.status === 'completed' || record.status === 'partial'
}

function bucketIndex(date: string, window: ReadinessAnalysisWindow): number {
  const start = parseIsoDate(window.startDate).getTime()
  const current = parseIsoDate(date).getTime()
  return Math.floor((current - start) / DAY_MS / window.bucketDays)
}

export function evaluateReadinessDataSufficiency(input: {
  readonly records: readonly RealizedTrainingRecord[]
  readonly teamId: string
  readonly athleteId: string
  readonly endDate: string
  readonly policy: ReadinessDataSufficiencyPolicy
}): ReadinessDataSufficiency {
  assertPolicy(input.policy)
  const window = buildReadinessAnalysisWindow({ endDate: input.endDate, policy: input.policy })

  const scoped = input.records.filter((record) => (
    record.teamId === input.teamId
    && record.athleteId === input.athleteId
    && isWithinWindow(record.date, window)
  ))
  const performedRecords = scoped.filter(performed)
  const activeBuckets = new Set(performedRecords.map((record) => bucketIndex(record.date, window))).size
  const totalBuckets = Math.ceil(window.windowDays / window.bucketDays)

  const metrics = Object.fromEntries(METRIC_NAMES.map((metric) => {
    const knownRecords = performedRecords.filter((record) => record.metrics[metric].state === 'known').length
    const ratio = performedRecords.length === 0 ? 0 : knownRecords / performedRecords.length
    return [metric, {
      metric,
      knownRecords,
      performedRecords: performedRecords.length,
      ratio,
      sufficient: performedRecords.length > 0 && ratio >= input.policy.minimumMetricCoverageRatio,
    }]
  })) as ReadinessDataCoverage['metrics']

  const coverage: ReadinessDataCoverage = {
    window,
    performedRecords: performedRecords.length,
    activeBuckets,
    totalBuckets,
    explicitMissedRecords: scoped.filter(({ status }) => status === 'missed').length,
    ambiguousRecords: scoped.filter(({ quality }) => quality === 'ambiguous').length,
    metrics,
  }

  const reasons: ReadinessDataInsufficiencyReason[] = []
  if (performedRecords.length === 0) reasons.push('no_performed_records')
  if (performedRecords.length < input.policy.minimumPerformedSessions) {
    reasons.push('too_few_performed_sessions')
  }
  if (activeBuckets < input.policy.minimumActiveBuckets) {
    reasons.push('too_few_active_buckets')
  }

  return reasons.length === 0
    ? { status: 'sufficient', coverage }
    : { status: 'insufficient_data', coverage, reasons }
}

/**
 * Indicator-specific sufficiency. The overall record window may be usable even
 * when one dimension (for example D+) lacks enough observations.
 */
export function isMetricCoverageSufficient(
  coverage: ReadinessDataCoverage,
  metric: RealizedMetricName,
): boolean {
  return coverage.metrics[metric].sufficient
}
