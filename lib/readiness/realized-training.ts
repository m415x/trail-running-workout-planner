import type {
  RawRealizedTrainingRecord,
  RealizedMetric,
  RealizedMetricName,
  RealizedTrainingDeduplicationResult,
  RealizedTrainingQuality,
  RealizedTrainingRecord,
} from '@/types/training/readiness.types'

const PERFORMED_STATUSES = new Set(['completed', 'partial'] as const)

function isFiniteNonNegative(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0
}

function metric(
  name: RealizedMetricName,
  value: number | null,
  knownFields: ReadonlySet<RealizedMetricName> | null,
): RealizedMetric {
  if (!isFiniteNonNegative(value)) {
    return {
      state: 'unknown',
      reason: value === null ? 'not_recorded' : 'invalid_value',
    }
  }

  if (knownFields?.has(name)) return { state: 'known', value }

  // Existing workout_logs used zero defaults and did not persist field-level
  // known-ness. Non-zero legacy values are evidence of an observation; a zero
  // cannot be distinguished from an untouched default.
  if (knownFields === null && value > 0) return { state: 'known', value }

  return {
    state: 'unknown',
    reason: value === 0 ? 'legacy_zero_ambiguous' : 'not_recorded',
  }
}

function qualityFor(
  status: RawRealizedTrainingRecord['status'],
  metrics: RealizedTrainingRecord['metrics'],
): RealizedTrainingQuality {
  if (status === 'missed') return 'explicit_missed'
  if (!PERFORMED_STATUSES.has(status as 'completed' | 'partial')) return 'non_exposure'

  const values = Object.values(metrics)
  const knownCount = values.filter(({ state }) => state === 'known').length
  if (knownCount === 0) return 'ambiguous'
  if (knownCount === values.length) return 'usable'
  return 'partial'
}

export function normalizeRealizedTrainingRecord(
  raw: RawRealizedTrainingRecord,
): RealizedTrainingRecord {
  const knownFields = raw.knownMetricFields === null
    ? null
    : new Set(raw.knownMetricFields)

  const metrics = {
    distanceKm: metric('distanceKm', raw.distanceKm, knownFields),
    durationMin: metric('durationMin', raw.durationMin, knownFields),
    elevationGainM: metric('elevationGainM', raw.elevationGainM, knownFields),
    avgHrBpm: metric('avgHrBpm', raw.avgHrBpm, knownFields),
    rpe: metric('rpe', raw.rpe, knownFields),
  } as const

  const limitations: string[] = []
  if (raw.knownMetricFields === null) {
    limitations.push('legacy_record_without_metric_evidence')
  }
  if (raw.sessionId === null) {
    limitations.push('no_authoritative_session_link')
  }
  if (Object.values(metrics).some(({ state }) => state === 'unknown')) {
    limitations.push('partial_metric_coverage')
  }

  return {
    id: raw.id,
    teamId: raw.teamId,
    athleteId: raw.athleteId,
    sessionId: raw.sessionId,
    workoutId: raw.workoutId,
    date: raw.date,
    status: raw.status,
    metrics,
    provenance: {
      source: raw.source,
      sourceActivityId: raw.sourceActivityId,
      loggedAt: raw.loggedAt,
      sessionLink: raw.sessionId === null ? 'none' : 'explicit',
    },
    quality: qualityFor(raw.status, metrics),
    limitations,
  }
}

function stableSourceKey(record: RealizedTrainingRecord): string | null {
  const sourceActivityId = record.provenance.sourceActivityId
  if (sourceActivityId === null) return null
  return `${record.provenance.source}:${sourceActivityId}`
}

/**
 * Deduplicates only with trustworthy identity: the persisted log ID itself or
 * an explicit stable source activity ID. Metric/date similarity is never used.
 */
export function deduplicateRealizedTrainingRecords(
  input: readonly RealizedTrainingRecord[],
): RealizedTrainingDeduplicationResult {
  const records: RealizedTrainingRecord[] = []
  const duplicateRecordIds: string[] = []
  const ambiguousRecordIds: string[] = []
  const byId = new Set<string>()
  const bySource = new Map<string, string>()

  for (const record of input) {
    if (byId.has(record.id)) {
      duplicateRecordIds.push(record.id)
      continue
    }
    byId.add(record.id)

    const key = stableSourceKey(record)
    if (key !== null) {
      const existing = bySource.get(key)
      if (existing !== undefined) {
        duplicateRecordIds.push(record.id)
        continue
      }
      bySource.set(key, record.id)
    } else if (record.provenance.source === 'imported') {
      ambiguousRecordIds.push(record.id)
    }

    records.push(record)
  }

  return {
    records,
    duplicateRecordIds,
    ambiguousRecordIds,
  }
}

export function hasAuthoritativeSessionLink(record: RealizedTrainingRecord): boolean {
  return record.sessionId !== null && record.provenance.sessionLink === 'explicit'
}
