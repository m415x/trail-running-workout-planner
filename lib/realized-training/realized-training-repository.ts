import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { athleteProfiles, workoutLogs } from '@/db/schema'
import { workoutLogEvidence } from '@/db/readiness-schema'
import { normalizeRealizedTrainingRecord } from '@/lib/readiness/realized-training'
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
    .where(eq(workoutLogs.id, id))
    .get()

  if (!row) return null

  return normalizeRealizedTrainingRecord(
    mapPersistenceToRawRealizedTrainingRecord({
      teamId: row.teamId,
      log: row.log,
      evidence: row.evidence,
    }),
  )
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

  const timestamp = now()
  const rows = mapManualCaptureToPersistenceRows(validation.value, {
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
