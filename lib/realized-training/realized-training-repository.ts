import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { athleteProfiles, sessions, workoutLogs } from '@/db/schema'
import { workoutLogEvidence } from '@/db/readiness-schema'
import { normalizeRealizedTrainingRecord } from '@/lib/readiness/realized-training'
import {
  resolveAuthoritativeSessionLink,
  type RealizedTrainingSessionLinkCandidate,
} from '@/lib/realized-training/authoritative-session-link'
import { validateManualRealizedTrainingCapture } from '@/lib/realized-training/capture-contract'
import {
  mapManualCaptureToPersistenceRows,
  mapPersistenceToRawRealizedTrainingRecord,
} from '@/lib/realized-training/persistence-mapping'
import type { ManualRealizedTrainingCaptureInput } from '@/types/training/realized-training-capture.types'
import type { RealizedTrainingRecord } from '@/types/training/readiness.types'

export class InvalidRealizedTrainingCaptureError extends Error {
  readonly code = 'invalid_realized_training_capture'

  constructor(
    readonly issues: ReturnType<typeof validateManualRealizedTrainingCapture> extends infer TResult
      ? TResult extends { ok: false; issues: infer TIssues }
        ? TIssues
        : never
      : never,
  ) {
    super('Realized training capture is invalid')
    this.name = 'InvalidRealizedTrainingCaptureError'
  }
}

function now() {
  return new Date().toISOString()
}

function resolveCaptureScope(
  input: ManualRealizedTrainingCaptureInput,
): ManualRealizedTrainingCaptureInput {
  const athlete = db
    .select({
      id: athleteProfiles.id,
      teamId: athleteProfiles.teamId,
      isDeleted: athleteProfiles.isDeleted,
    })
    .from(athleteProfiles)
    .where(eq(athleteProfiles.id, input.athleteId))
    .get() ?? null

  let session: RealizedTrainingSessionLinkCandidate | null = null
  if (input.sessionId !== null) {
    session = db
      .select({
        id: sessions.id,
        teamId: sessions.teamId,
        workoutId: sessions.workoutId,
        isDeleted: sessions.isDeleted,
      })
      .from(sessions)
      .where(eq(sessions.id, input.sessionId))
      .get() ?? null
  }

  return resolveAuthoritativeSessionLink({ capture: input, athlete, session })
}

function normalizePersistenceRow(row: {
  log: typeof workoutLogs.$inferSelect
  evidence: typeof workoutLogEvidence.$inferSelect | null
  teamId: string
}): RealizedTrainingRecord {
  return normalizeRealizedTrainingRecord(
    mapPersistenceToRawRealizedTrainingRecord({
      teamId: row.teamId,
      log: row.log,
      evidence: row.evidence,
    }),
  )
}

/**
 * Reads one realized-training record through the authoritative athlete -> team
 * relationship. The returned H12 record never trusts a caller-provided team id.
 */
export function getRealizedTrainingRecord(id: string): RealizedTrainingRecord | null {
  const row = db
    .select({
      log: workoutLogs,
      evidence: workoutLogEvidence,
      teamId: athleteProfiles.teamId,
    })
    .from(workoutLogs)
    .innerJoin(athleteProfiles, eq(workoutLogs.athleteId, athleteProfiles.id))
    .leftJoin(workoutLogEvidence, eq(workoutLogEvidence.workoutLogId, workoutLogs.id))
    .where(and(eq(workoutLogs.id, id), eq(workoutLogs.isDeleted, false), eq(athleteProfiles.isDeleted, false)))
    .get()

  return row ? normalizePersistenceRow(row) : null
}

/**
 * Lists durable realized-training evidence for one athlete, newest analysis day
 * first. Planned sessions are not returned unless an explicit realized row links
 * to them; absence of a row therefore remains unknown rather than "missed".
 */
export function listRealizedTrainingRecordsForAthlete(athleteId: string): RealizedTrainingRecord[] {
  const rows = db
    .select({
      log: workoutLogs,
      evidence: workoutLogEvidence,
      teamId: athleteProfiles.teamId,
    })
    .from(workoutLogs)
    .innerJoin(athleteProfiles, eq(workoutLogs.athleteId, athleteProfiles.id))
    .leftJoin(workoutLogEvidence, eq(workoutLogEvidence.workoutLogId, workoutLogs.id))
    .where(and(
      eq(workoutLogs.athleteId, athleteId),
      eq(workoutLogs.isDeleted, false),
      eq(athleteProfiles.isDeleted, false),
    ))
    .orderBy(desc(workoutLogs.date), desc(workoutLogs.loggedAt))
    .all()

  return rows.map(normalizePersistenceRow)
}

/**
 * Persists the realized row and its evidence sidecar in one SQLite transaction.
 * A partial write must never be observable: either both rows commit or neither
 * does. Provenance is server-owned for manual capture.
 */
export function createManualRealizedTrainingRecord(
  input: ManualRealizedTrainingCaptureInput,
): RealizedTrainingRecord {
  const validation = validateManualRealizedTrainingCapture(input)
  if (!validation.ok) throw new InvalidRealizedTrainingCaptureError(validation.issues)

  const scopedCapture = resolveCaptureScope(validation.value)
  const timestamp = now()
  const rows = mapManualCaptureToPersistenceRows(scopedCapture, {
    workoutLogId: randomUUID(),
    evidenceId: randomUUID(),
    loggedAt: timestamp,
  })

  db.transaction((tx) => {
    tx.insert(workoutLogs)
      .values({
        ...rows.workoutLog,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run()

    tx.insert(workoutLogEvidence)
      .values({
        ...rows.evidence,
        knownMetricFields: [...rows.evidence.knownMetricFields],
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run()
  })

  const persisted = getRealizedTrainingRecord(rows.workoutLog.id)
  if (!persisted) {
    throw new Error('Realized training record was committed but could not be reloaded')
  }

  return persisted
}