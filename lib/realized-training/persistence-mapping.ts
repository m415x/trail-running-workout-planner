import type {
  ManualRealizedTrainingCaptureInput,
  RealizedTrainingCaptureMetric,
} from '@/types/training/realized-training-capture.types'
import type {
  RawRealizedTrainingRecord,
  RealizedMetricName,
} from '@/types/training/readiness.types'

export interface ManualRealizedTrainingPersistenceContext {
  readonly workoutLogId: string
  readonly evidenceId: string
  readonly loggedAt: string
}

export interface WorkoutLogInsertValues {
  readonly id: string
  readonly athleteId: string
  readonly sessionId: string | null
  readonly workoutId: string | null
  readonly date: string
  readonly performedAt: string
  readonly status: ManualRealizedTrainingCaptureInput['status']
  readonly distanceKm: number
  readonly durationMin: number
  readonly elevationGain: number
  readonly avgHr: number | null
  readonly feeling: string | null
  readonly rpe: number
  readonly athleteNotes: string | null
  readonly loggedAt: string
}

export interface WorkoutLogEvidenceInsertValues {
  readonly id: string
  readonly workoutLogId: string
  readonly source: 'manual'
  readonly sourceActivityId: null
  readonly knownMetricFields: readonly RealizedMetricName[]
}

export interface ManualRealizedTrainingPersistenceRows {
  readonly workoutLog: WorkoutLogInsertValues
  readonly evidence: WorkoutLogEvidenceInsertValues
}

function numericFallback(metric: RealizedTrainingCaptureMetric): number {
  return metric.state === 'known' ? metric.value : 0
}

function nullableNumeric(metric: RealizedTrainingCaptureMetric): number | null {
  return metric.state === 'known' ? metric.value : null
}

function knownMetricFields(
  metrics: ManualRealizedTrainingCaptureInput['metrics'],
): RealizedMetricName[] {
  const fields: RealizedMetricName[] = []

  if (metrics.distanceKm.state === 'known') fields.push('distanceKm')
  if (metrics.durationMin.state === 'known') fields.push('durationMin')
  if (metrics.elevationGainM.state === 'known') fields.push('elevationGainM')
  if (metrics.avgHrBpm.state === 'known') fields.push('avgHrBpm')
  if (metrics.rpe.state === 'known') fields.push('rpe')

  return fields
}

/**
 * Encodes the durable capture contract into the existing `workout_logs` row
 * plus its H12 evidence sidecar.
 *
 * `workout_logs` still has legacy numeric zero defaults. Unknown metrics are
 * therefore encoded with storage fallbacks, while `knownMetricFields` remains
 * the authority that distinguishes unknown from an explicitly observed zero.
 * Consumers must not infer metric knowledge from the numeric row alone.
 */
export function mapManualCaptureToPersistenceRows(
  input: ManualRealizedTrainingCaptureInput,
  context: ManualRealizedTrainingPersistenceContext,
): ManualRealizedTrainingPersistenceRows {
  return {
    workoutLog: {
      id: context.workoutLogId,
      athleteId: input.athleteId,
      sessionId: input.sessionId,
      workoutId: input.workoutId,
      date: input.date,
      performedAt: new Date(input.performedAt).toISOString(),
      status: input.status,
      distanceKm: numericFallback(input.metrics.distanceKm),
      durationMin: numericFallback(input.metrics.durationMin),
      elevationGain: numericFallback(input.metrics.elevationGainM),
      avgHr: nullableNumeric(input.metrics.avgHrBpm),
      feeling: input.feeling,
      rpe: numericFallback(input.metrics.rpe),
      athleteNotes: input.athleteNotes,
      loggedAt: context.loggedAt,
    },
    evidence: {
      id: context.evidenceId,
      workoutLogId: context.workoutLogId,
      source: 'manual',
      sourceActivityId: null,
      knownMetricFields: knownMetricFields(input.metrics),
    },
  }
}

export interface PersistedWorkoutLogProjection {
  readonly id: string
  readonly athleteId: string
  readonly sessionId: string | null
  readonly workoutId: string | null
  readonly date: string
  readonly performedAt?: string | null
  readonly status: RawRealizedTrainingRecord['status']
  readonly distanceKm: number | null
  readonly durationMin: number | null
  readonly elevationGain: number | null
  readonly avgHr: number | null
  readonly rpe: number | null
  readonly loggedAt: string
}

export interface PersistedWorkoutLogEvidenceProjection {
  readonly source: RawRealizedTrainingRecord['source']
  readonly sourceActivityId: string | null
  readonly knownMetricFields: readonly RealizedMetricName[]
}

/**
 * Builds the H12 raw boundary from persisted rows. Missing evidence is kept as
 * legacy ambiguity by returning `knownMetricFields: null`.
 */
export function mapPersistenceToRawRealizedTrainingRecord(input: {
  readonly teamId: string
  readonly log: PersistedWorkoutLogProjection
  readonly evidence: PersistedWorkoutLogEvidenceProjection | null
}): RawRealizedTrainingRecord {
  return {
    id: input.log.id,
    teamId: input.teamId,
    athleteId: input.log.athleteId,
    sessionId: input.log.sessionId,
    workoutId: input.log.workoutId,
    date: input.log.date,
    performedAt: input.log.performedAt ?? null,
    status: input.log.status,
    distanceKm: input.log.distanceKm,
    durationMin: input.log.durationMin,
    elevationGainM: input.log.elevationGain,
    avgHrBpm: input.log.avgHr,
    rpe: input.log.rpe,
    loggedAt: input.log.loggedAt,
    source: input.evidence?.source ?? 'manual',
    sourceActivityId: input.evidence?.sourceActivityId ?? null,
    knownMetricFields: input.evidence?.knownMetricFields ?? null,
  }
}
