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
    performedAt: raw.performedAt ?? null,
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

/**
 * Returns the only cross-record identity accepted for imported evidence.
 *
 * A source activity ID must be explicit and non-blank. Manual records never
 * acquire a synthetic stable identity, because date/metrics/session similarity
 * is not proof that two observations represent the same performed activity.
 * Future providers must namespace their sourceActivityId values if several
 * providers share the generic `imported` source boundary.
 */
export function stableRealizedTrainingSourceKey(record: RealizedTrainingRecord): string | null {
  if (record.provenance.source === 'manual') return null

  const sourceActivityId = record.provenance.sourceActivityId?.trim()
  if (!sourceActivityId) return null

  return `${record.provenance.source}:${sourceActivityId}`
}

/**
 * Deduplicates only with trustworthy identity: the persisted log ID itself or
 * an explicit stable source activity ID. Metric/date/session similarity is never
 * used. Imported rows without stable identity remain visible and are marked
 * ambiguous so downstream analysis can account for their provenance quality.
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

    const key = stableRealizedTrainingSourceKey(record)
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
