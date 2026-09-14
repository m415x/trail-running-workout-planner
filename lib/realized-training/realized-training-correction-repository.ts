import { randomUUID } from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { athleteProfiles, sessions, workoutLogs } from '@/db/schema'
import { workoutLogCorrections, workoutLogEvidence } from '@/db/readiness-schema'
import { resolveAuthoritativeSessionLink } from '@/lib/realized-training/authoritative-session-link'
import { validateManualRealizedTrainingCapture } from '@/lib/realized-training/capture-contract'
import { mapManualCaptureToPersistenceRows } from '@/lib/realized-training/persistence-mapping'
import { getRealizedTrainingRecord, InvalidRealizedTrainingCaptureError } from '@/lib/realized-training/realized-training-repository'
import type {
  ManualRealizedTrainingCorrectionInput,
  RealizedTrainingCorrectionRecord,
  RealizedTrainingCorrectionSnapshot,
} from '@/types/training/realized-training-correction.types'
import type {
  ManualRealizedTrainingCaptureInput,
  RealizedTrainingCaptureMetric,
} from '@/types/training/realized-training-capture.types'
import type { RealizedMetricName, RealizedTrainingRecord } from '@/types/training/readiness.types'

function metric(
  field: RealizedMetricName,
  value: number | null,
  knownMetricFields: readonly RealizedMetricName[],
): RealizedTrainingCaptureMetric {
  return knownMetricFields.includes(field) && value !== null
    ? { state: 'known', value }
    : { state: 'unknown' }
}

function snapshotFromRows(
  log: typeof workoutLogs.$inferSelect,
  evidence: typeof workoutLogEvidence.$inferSelect,
): RealizedTrainingCorrectionSnapshot {
  return {
    sessionId: log.sessionId,
    workoutId: log.workoutId,
    date: log.date,
    performedAt: log.performedAt,
    status: log.status as RealizedTrainingCorrectionSnapshot['status'],
    metrics: {
      distanceKm: metric('distanceKm', log.distanceKm, evidence.knownMetricFields),
      durationMin: metric('durationMin', log.durationMin, evidence.knownMetricFields),
      elevationGainM: metric('elevationGainM', log.elevationGain, evidence.knownMetricFields),
      avgHrBpm: metric('avgHrBpm', log.avgHr, evidence.knownMetricFields),
      rpe: metric('rpe', log.rpe, evidence.knownMetricFields),
    },
    feeling: log.feeling,
    athleteNotes: log.athleteNotes,
  }
}

function resolveReplacementScope(
  input: ManualRealizedTrainingCaptureInput,
): ManualRealizedTrainingCaptureInput {
  const athlete = db
    .select({ id: athleteProfiles.id, teamId: athleteProfiles.teamId, isDeleted: athleteProfiles.isDeleted })
    .from(athleteProfiles)
    .where(eq(athleteProfiles.id, input.athleteId))
    .get() ?? null

  const session = input.sessionId === null
    ? null
    : db
      .select({ id: sessions.id, teamId: sessions.teamId, workoutId: sessions.workoutId, isDeleted: sessions.isDeleted })
      .from(sessions)
      .where(eq(sessions.id, input.sessionId))
      .get() ?? null

  return resolveAuthoritativeSessionLink({ capture: input, athlete, session })
}

/**
 * Corrects one manual realized-training row without destroying its previous
 * evidence. The live row is updated and an immutable before/after audit record
 * is appended in the same transaction.
 */
export function correctManualRealizedTrainingRecord(
  input: ManualRealizedTrainingCorrectionInput,
): RealizedTrainingRecord {
  const existing = db
    .select({ log: workoutLogs, evidence: workoutLogEvidence })
    .from(workoutLogs)
    .innerJoin(workoutLogEvidence, eq(workoutLogEvidence.workoutLogId, workoutLogs.id))
    .where(and(
      eq(workoutLogs.id, input.workoutLogId),
      eq(workoutLogs.athleteId, input.athleteId),
      eq(workoutLogs.isDeleted, false),
    ))
    .get()

  if (!existing) throw new Error('realized_training_record_not_found')
  if (existing.evidence.source !== 'manual') throw new Error('imported_realized_training_requires_source_correction')

  const replacement: ManualRealizedTrainingCaptureInput = {
    ...input.replacement,
    athleteId: input.athleteId,
  }
  const validation = validateManualRealizedTrainingCapture(replacement)
  if (!validation.ok) throw new InvalidRealizedTrainingCaptureError(validation.issues)

  const scopedReplacement = resolveReplacementScope(validation.value)
  const correctedAt = new Date().toISOString()
  const mapped = mapManualCaptureToPersistenceRows(scopedReplacement, {
    workoutLogId: existing.log.id,
    evidenceId: existing.evidence.id,
    loggedAt: existing.log.loggedAt,
  })
  const before = snapshotFromRows(existing.log, existing.evidence)
  const after: RealizedTrainingCorrectionSnapshot = {
    sessionId: mapped.workoutLog.sessionId,
    workoutId: mapped.workoutLog.workoutId,
    date: mapped.workoutLog.date,
    performedAt: mapped.workoutLog.performedAt,
    status: mapped.workoutLog.status,
    metrics: scopedReplacement.metrics,
    feeling: mapped.workoutLog.feeling,
    athleteNotes: mapped.workoutLog.athleteNotes,
  }

  db.transaction((tx) => {
    tx.update(workoutLogs)
      .set({
        sessionId: mapped.workoutLog.sessionId,
        workoutId: mapped.workoutLog.workoutId,
        date: mapped.workoutLog.date,
        performedAt: mapped.workoutLog.performedAt,
        status: mapped.workoutLog.status,
        distanceKm: mapped.workoutLog.distanceKm,
        durationMin: mapped.workoutLog.durationMin,
        elevationGain: mapped.workoutLog.elevationGain,
        avgHr: mapped.workoutLog.avgHr,
        feeling: mapped.workoutLog.feeling,
        rpe: mapped.workoutLog.rpe,
        athleteNotes: mapped.workoutLog.athleteNotes,
        updatedAt: correctedAt,
      })
      .where(eq(workoutLogs.id, existing.log.id))
      .run()

    tx.update(workoutLogEvidence)
      .set({
        knownMetricFields: [...mapped.evidence.knownMetricFields],
        updatedAt: correctedAt,
      })
      .where(eq(workoutLogEvidence.id, existing.evidence.id))
      .run()

    tx.insert(workoutLogCorrections).values({
      id: randomUUID(),
      workoutLogId: existing.log.id,
      correctedByUserId: input.correctedByUserId,
      correctedAt,
      reason: input.reason?.trim() || null,
      beforeSnapshot: before,
      afterSnapshot: after,
      createdAt: correctedAt,
      updatedAt: correctedAt,
    }).run()
  })

  const corrected = getRealizedTrainingRecord(existing.log.id)
  if (!corrected) throw new Error('corrected_realized_training_record_not_found')
  return corrected
}

/** Returns the immutable correction history for one workout log, oldest first. */
export function listRealizedTrainingCorrections(workoutLogId: string): RealizedTrainingCorrectionRecord[] {
  return db
    .select()
    .from(workoutLogCorrections)
    .where(and(
      eq(workoutLogCorrections.workoutLogId, workoutLogId),
      eq(workoutLogCorrections.isDeleted, false),
    ))
    .orderBy(asc(workoutLogCorrections.correctedAt))
    .all()
    .map((row) => ({
      id: row.id,
      workoutLogId: row.workoutLogId,
      correctedByUserId: row.correctedByUserId,
      correctedAt: row.correctedAt,
      reason: row.reason,
      before: row.beforeSnapshot,
      after: row.afterSnapshot,
    }))
}
