import type Database from 'better-sqlite3'

import {
  SESSION_GENERATION_SNAPSHOT_LIMITS,
  validateSessionGenerationSnapshotEnvelope,
} from '@/lib/session-generation/review-snapshot-limits'

/**
 * KAN-789/T4: SQLite adapter for short-lived review evidence.
 * Caller must supply H2/H3/H4A-authorized ownership; an opaque ID alone is
 * never authority. The PostgreSQL adapter and authorization boundary remain
 * separate work.
 */
interface SnapshotScope {
  readonly id: string
  readonly userId: string
  readonly teamId: string
  readonly groupTrainingPlanId: string
}

interface SnapshotCreation extends SnapshotScope {
  readonly groupId: string
  readonly planningCohortId: string | null
  readonly schemaVersion: string
  readonly generatorVersion: string
  readonly proposal: unknown
  readonly generationExplanations: unknown
  readonly sourceManifest: unknown
  readonly sessionCount: number
  readonly microcycleCount: number
}

interface SnapshotRow {
  id: string
  user_id: string
  team_id: string
  group_training_plan_id: string
  group_id: string
  planning_cohort_id: string | null
  schema_version: string
  generator_version: string
  proposal: string
  generation_explanations: string
  source_manifest: string
  created_at: string
  expires_at: string
  status: 'active' | 'consumed' | 'expired' | 'invalidated'
  consumed_at: string | null
  result_reference: string | null
}

export interface ReviewSnapshotRecord {
  readonly id: string
  readonly userId: string
  readonly teamId: string
  readonly groupTrainingPlanId: string
  readonly groupId: string
  readonly planningCohortId: string | null
  readonly schemaVersion: string
  readonly generatorVersion: string
  readonly proposal: unknown
  readonly generationExplanations: unknown
  readonly sourceManifest: unknown
  readonly createdAt: string
  readonly expiresAt: string
  readonly status: SnapshotRow['status']
  readonly consumedAt: string | null
  readonly resultReference: string | null
}

function validTime(value: string): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error('Snapshot requires canonical ISO timestamp')
  }
  return value
}

function record(row: SnapshotRow): ReviewSnapshotRecord {
  return {
    id: row.id,
    userId: row.user_id,
    teamId: row.team_id,
    groupTrainingPlanId: row.group_training_plan_id,
    groupId: row.group_id,
    planningCohortId: row.planning_cohort_id,
    schemaVersion: row.schema_version,
    generatorVersion: row.generator_version,
    proposal: JSON.parse(row.proposal),
    generationExplanations: JSON.parse(row.generation_explanations),
    sourceManifest: JSON.parse(row.source_manifest),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    status: row.status,
    consumedAt: row.consumed_at,
    resultReference: row.result_reference,
  }
}

/** Write transaction serializes expiry and quota check with INSERT on one SQLite connection. */
export function createReviewSnapshotSqlite(
  database: Database.Database,
  input: SnapshotCreation,
  nowIso: string,
): ReviewSnapshotRecord {
  const now = validTime(nowIso)
  validateSessionGenerationSnapshotEnvelope(input)

  const expiresAt = new Date(
    Date.parse(now) + SESSION_GENERATION_SNAPSHOT_LIMITS.ttlMinutes * 60_000,
  ).toISOString()

  const write = database.transaction(() => {
    database.prepare(`
      UPDATE session_generation_review_snapshots
      SET status = 'expired'
      WHERE user_id = ? AND team_id = ? AND group_training_plan_id = ?
        AND status = 'active' AND expires_at <= ?
    `).run(input.userId, input.teamId, input.groupTrainingPlanId, now)

    const count = database.prepare(`
      SELECT count(*) AS count
      FROM session_generation_review_snapshots
      WHERE user_id = ? AND team_id = ? AND group_training_plan_id = ?
        AND status = 'active' AND expires_at > ?
    `).get(input.userId, input.teamId, input.groupTrainingPlanId, now) as { count: number }

    if (count.count >= SESSION_GENERATION_SNAPSHOT_LIMITS.maxActivePerOwnerPlan) {
      throw new Error('Snapshot active quota limit reached')
    }

    database.prepare(`
      INSERT INTO session_generation_review_snapshots (
        id, user_id, team_id, group_training_plan_id, group_id, planning_cohort_id,
        schema_version, generator_version, proposal, generation_explanations,
        source_manifest, created_at, expires_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      input.id, input.userId, input.teamId, input.groupTrainingPlanId,
      input.groupId, input.planningCohortId, input.schemaVersion,
      input.generatorVersion, JSON.stringify(input.proposal),
      JSON.stringify(input.generationExplanations), JSON.stringify(input.sourceManifest),
      now, expiresAt,
    )

    return getActiveReviewSnapshotSqlite(database, input, now)
  })

  const result = write.immediate()
  if (!result) throw new Error('Snapshot insert failed')
  return result
}

/** A read never mutates lifecycle state; expiry is enforced in its WHERE clause. */
export function getActiveReviewSnapshotSqlite(
  database: Database.Database,
  scope: SnapshotScope,
  nowIso: string,
): ReviewSnapshotRecord | null {
  const now = validTime(nowIso)
  const row = database.prepare(`
    SELECT *
    FROM session_generation_review_snapshots
    WHERE id = ? AND user_id = ? AND team_id = ? AND group_training_plan_id = ?
      AND status = 'active' AND expires_at > ?
    LIMIT 1
  `).get(scope.id, scope.userId, scope.teamId, scope.groupTrainingPlanId, now) as SnapshotRow | undefined
  return row ? record(row) : null
}

export type ConsumeReviewSnapshotSqliteResult =
  | { readonly kind: 'consumed'; readonly resultReference: string }
  | { readonly kind: 'already_consumed'; readonly resultReference: string }
  | { readonly kind: 'unavailable' }

/**
 * Atomically claim an ACTIVE, non-expired snapshot and persist its result.
 * The persist callback MUST use this same SQLite connection, synchronously.
 * H2/H3/H4A authorization, current source validation and reconciliation must
 * already be performed by the calling boundary before any durable writes.
 */
export function consumeReviewSnapshotSqlite(
  database: Database.Database,
  scope: SnapshotScope,
  nowIso: string,
  persist: (snapshot: ReviewSnapshotRecord) => string,
): ConsumeReviewSnapshotSqliteResult {
  const now = validTime(nowIso)
  const consume = database.transaction((): ConsumeReviewSnapshotSqliteResult => {
    const row = database.prepare(`
      SELECT *
      FROM session_generation_review_snapshots
      WHERE id = ? AND user_id = ? AND team_id = ? AND group_training_plan_id = ?
      LIMIT 1
    `).get(scope.id, scope.userId, scope.teamId, scope.groupTrainingPlanId) as SnapshotRow | undefined

    if (!row) return { kind: 'unavailable' }

    if (row.status === 'consumed') {
      if (!row.result_reference || !row.consumed_at) {
        throw new Error('Snapshot consumed without durable result reference')
      }
      return { kind: 'already_consumed', resultReference: row.result_reference }
    }

    if (row.status !== 'active' || row.expires_at <= now) {
      return { kind: 'unavailable' }
    }

    const changed = database.prepare(`
      UPDATE session_generation_review_snapshots
      SET status = 'consumed', consumed_at = ?
      WHERE id = ? AND user_id = ? AND team_id = ? AND group_training_plan_id = ?
        AND status = 'active' AND expires_at > ?
        AND consumed_at IS NULL AND result_reference IS NULL
    `).run(now, scope.id, scope.userId, scope.teamId, scope.groupTrainingPlanId, now)

    if (changed.changes !== 1) return { kind: 'unavailable' }

    const resultReference = persist(record(row))
    if (typeof resultReference !== 'string' || resultReference.trim().length === 0) {
      throw new Error('Snapshot persist must return a durable result reference')
    }

    const completed = database.prepare(`
      UPDATE session_generation_review_snapshots
      SET result_reference = ?
      WHERE id = ? AND user_id = ? AND team_id = ? AND group_training_plan_id = ?
        AND status = 'consumed' AND consumed_at = ? AND result_reference IS NULL
    `).run(resultReference, scope.id, scope.userId, scope.teamId, scope.groupTrainingPlanId, now)

    if (completed.changes !== 1) {
      throw new Error('Snapshot consumption result could not be recorded')
    }

    return { kind: 'consumed', resultReference }
  })

  return consume.immediate()
}

/**
 * Explicit, owner-scoped invalidation of an unconsumed review snapshot.
 * Consumed evidence and its durable result reference are never modified.
 * An expired snapshot is unavailable rather than eligible for invalidation.
 */
export function invalidateReviewSnapshotSqlite(
  database: Database.Database,
  scope: SnapshotScope,
  nowIso: string,
): boolean {
  const now = validTime(nowIso)
  const result = database.prepare(`
    UPDATE session_generation_review_snapshots
    SET status = 'invalidated'
    WHERE id = ? AND user_id = ? AND team_id = ? AND group_training_plan_id = ?
      AND status = 'active' AND expires_at > ?
      AND consumed_at IS NULL AND result_reference IS NULL
  `).run(scope.id, scope.userId, scope.teamId, scope.groupTrainingPlanId, now)
  return result.changes === 1
}
