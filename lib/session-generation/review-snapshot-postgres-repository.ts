import type postgres from 'postgres'

import {
  SESSION_GENERATION_SNAPSHOT_LIMITS,
  validateSessionGenerationSnapshotEnvelope,
} from '@/lib/session-generation/review-snapshot-limits'

type PostgresClient = ReturnType<typeof postgres>

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
  /** Explicit oldest ACTIVE review selected by caller; authorization is upstream. */
  readonly replaceSnapshotId?: string
}

export interface SnapshotRow {
  id: string
  userId: string
  teamId: string
  groupTrainingPlanId: string
  groupId: string
  planningCohortId: string | null
  schemaVersion: string
  generatorVersion: string
  proposal: unknown
  generationExplanations: unknown
  sourceManifest: unknown
  createdAt: string
  expiresAt: string
  status: 'active' | 'consumed' | 'expired' | 'invalidated'
  consumedAt: string | null
  resultReference: string | null
}

function canonicalTime(value: string): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error('Snapshot requires canonical ISO timestamp')
  }
  return value
}

/**
 * Transactional PostgreSQL allocation. Every writer for one owner/team/plan
 * must acquire this advisory transaction lock before checking ACTIVE quota.
 * The opaque snapshot id is not an authorization credential.
 */
export async function createReviewSnapshotPostgres(
  client: PostgresClient,
  input: SnapshotCreation,
  nowIso: string,
): Promise<SnapshotRow> {
  const now = canonicalTime(nowIso)
  validateSessionGenerationSnapshotEnvelope(input)
  const expiresAt = new Date(
    Date.parse(now) + SESSION_GENERATION_SNAPSHOT_LIMITS.ttlMinutes * 60_000,
  ).toISOString()
  const lockKey = JSON.stringify([input.userId, input.teamId, input.groupTrainingPlanId])

  return client.begin(async (tx) => {
    // Serialize concurrent quota checks across independent PG connections.
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`

    await tx`
      UPDATE session_generation_review_snapshots SET status = 'expired'
      WHERE user_id = ${input.userId}
        AND team_id = ${input.teamId}
        AND group_training_plan_id = ${input.groupTrainingPlanId}
        AND status = 'active' AND expires_at <= ${now}
    `

    if (input.replaceSnapshotId !== undefined) {
      if (typeof input.replaceSnapshotId !== 'string' || !input.replaceSnapshotId) {
        throw new Error('Snapshot replacement requires an explicit valid ID')
      }

      // The same advisory lock covers allocation and replacement for this scope.
      const oldest = await tx<{ id: string }[]>`
        SELECT id FROM session_generation_review_snapshots
        WHERE user_id = ${input.userId}
          AND team_id = ${input.teamId}
          AND group_training_plan_id = ${input.groupTrainingPlanId}
          AND status = 'active' AND expires_at > ${now}
          AND consumed_at IS NULL AND result_reference IS NULL
        ORDER BY created_at ASC, id ASC
        LIMIT 1 FOR UPDATE
      `
      if (oldest[0]?.id !== input.replaceSnapshotId) {
        throw new Error('Snapshot replacement must target oldest active review in owner scope')
      }
      const replaced = await tx<{ id: string }[]>`
        UPDATE session_generation_review_snapshots
        SET status = 'invalidated'
        WHERE id = ${input.replaceSnapshotId}
          AND user_id = ${input.userId}
          AND team_id = ${input.teamId}
          AND group_training_plan_id = ${input.groupTrainingPlanId}
          AND status = 'active' AND expires_at > ${now}
          AND consumed_at IS NULL AND result_reference IS NULL
        RETURNING id
      `
      if (replaced.length !== 1) {
        throw new Error('Snapshot replacement failed to invalidate oldest active review')
      }
    }

    const counts = await tx<{ active: number }[]>`
      SELECT count(*)::integer AS active FROM session_generation_review_snapshots
      WHERE user_id = ${input.userId}
        AND team_id = ${input.teamId}
        AND group_training_plan_id = ${input.groupTrainingPlanId}
        AND status = 'active' AND expires_at > ${now}
    `
    if ((counts[0]?.active ?? 0) >= SESSION_GENERATION_SNAPSHOT_LIMITS.maxActivePerOwnerPlan) {
      throw new Error('Snapshot active quota limit reached')
    }

    const rows = await tx<SnapshotRow[]>`
      INSERT INTO session_generation_review_snapshots (
        id, user_id, team_id, group_training_plan_id, group_id,
        planning_cohort_id, schema_version, generator_version,
        proposal, generation_explanations, source_manifest,
        created_at, expires_at, status
      ) VALUES (
        ${input.id}, ${input.userId}, ${input.teamId},
        ${input.groupTrainingPlanId}, ${input.groupId},
        ${input.planningCohortId}, ${input.schemaVersion},
        ${input.generatorVersion},
        ${JSON.stringify(input.proposal)}::jsonb,
        ${JSON.stringify(input.generationExplanations)}::jsonb,
        ${JSON.stringify(input.sourceManifest)}::jsonb,
        ${now}, ${expiresAt}, 'active'
      )
      RETURNING
        id, user_id AS "userId", team_id AS "teamId",
        group_training_plan_id AS "groupTrainingPlanId",
        group_id AS "groupId", planning_cohort_id AS "planningCohortId",
        schema_version AS "schemaVersion", generator_version AS "generatorVersion",
        proposal, generation_explanations AS "generationExplanations",
        source_manifest AS "sourceManifest",
        created_at AS "createdAt", expires_at AS "expiresAt",
        status, consumed_at AS "consumedAt", result_reference AS "resultReference"
    `
    if (!rows[0]) throw new Error('Snapshot insert failed')
    return rows[0]
  })
}

/** Read-only GET; the caller must independently establish H2/H3/H4A authority. */
export async function getActiveReviewSnapshotPostgres(
  client: PostgresClient,
  scope: SnapshotScope,
  nowIso: string,
): Promise<SnapshotRow | null> {
  const now = canonicalTime(nowIso)
  const rows = await client<SnapshotRow[]>`
    SELECT
      id, user_id AS "userId", team_id AS "teamId",
      group_training_plan_id AS "groupTrainingPlanId",
      group_id AS "groupId", planning_cohort_id AS "planningCohortId",
      schema_version AS "schemaVersion", generator_version AS "generatorVersion",
      proposal, generation_explanations AS "generationExplanations",
      source_manifest AS "sourceManifest",
      created_at AS "createdAt", expires_at AS "expiresAt",
      status, consumed_at AS "consumedAt", result_reference AS "resultReference"
    FROM session_generation_review_snapshots
    WHERE id = ${scope.id}
      AND user_id = ${scope.userId}
      AND team_id = ${scope.teamId}
      AND group_training_plan_id = ${scope.groupTrainingPlanId}
      AND status = 'active' AND expires_at > ${now}
    LIMIT 1
  `
  return rows[0] ?? null
}

/** PostgreSQL serialization/deadlock retries; three total fresh transactions. */
const MAX_CONFIRM_ATTEMPTS = 3

function postgresSqlState(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null
  return typeof error.code === 'string' ? error.code : null
}

function retryableTransactionFailure(error: unknown): boolean {
  const code = postgresSqlState(error)
  return code === '40001' || code === '40P01'
}

export type ConsumeReviewSnapshotPostgresResult =
  | { readonly kind: 'consumed'; readonly resultReference: string }
  | { readonly kind: 'already_consumed'; readonly resultReference: string }
  | { readonly kind: 'unavailable' }

export type AuthorizedConsumeReviewSnapshotPostgresResult =
  | ConsumeReviewSnapshotPostgresResult
  | { readonly kind: 'denied' }

/**
 * Atomically persists the result and consumes an active snapshot.
 *
 * The callback MUST write using the supplied transaction client. The caller
 * must enforce authenticated H2/H3/H4A ownership and validate source freshness
 * within the appropriate transaction boundary; scoped SQL alone is not auth.
 */
export function consumeReviewSnapshotPostgres(
  client: PostgresClient,
  scope: SnapshotScope,
  nowIso: string,
  persist: (tx: postgres.TransactionSql, snapshot: SnapshotRow) => Promise<string>,
): Promise<ConsumeReviewSnapshotPostgresResult>
export function consumeReviewSnapshotPostgres(
  client: PostgresClient,
  scope: (tx: postgres.TransactionSql) => Promise<SnapshotScope | null>,
  nowIso: string,
  persist: (tx: postgres.TransactionSql, snapshot: SnapshotRow) => Promise<string>,
): Promise<AuthorizedConsumeReviewSnapshotPostgresResult>
export async function consumeReviewSnapshotPostgres(
  client: PostgresClient,
  scope: SnapshotScope | ((tx: postgres.TransactionSql) => Promise<SnapshotScope | null>),
  nowIso: string,
  persist: (tx: postgres.TransactionSql, snapshot: SnapshotRow) => Promise<string>,
): Promise<AuthorizedConsumeReviewSnapshotPostgresResult> {
  const now = canonicalTime(nowIso)

  for (let attempt = 1; attempt <= MAX_CONFIRM_ATTEMPTS; attempt++) {
    try {
      // A new begin() and new SQL snapshot for EVERY retry. Do not reuse
      // decisions, rows or a transaction handle from a failed attempt.
      return await client.begin(async (tx): Promise<AuthorizedConsumeReviewSnapshotPostgresResult> => {
        // Must be the first SQL statement issued in this transaction.
        await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
        // Re-evaluate trusted H2/H3/H4A scope within EVERY fresh retry,
        // before selecting or claiming a review. A denial never mutates CAS.
        const attemptScope = typeof scope === 'function' ? await scope(tx) : scope
        if (attemptScope === null) return { kind: 'denied' }
    // Row lock serializes concurrent attempts for this particular review ID.
    const rows = await tx<SnapshotRow[]>`
      SELECT
        id, user_id AS "userId", team_id AS "teamId",
        group_training_plan_id AS "groupTrainingPlanId",
        group_id AS "groupId", planning_cohort_id AS "planningCohortId",
        schema_version AS "schemaVersion", generator_version AS "generatorVersion",
        proposal, generation_explanations AS "generationExplanations",
        source_manifest AS "sourceManifest",
        created_at AS "createdAt", expires_at AS "expiresAt",
        status, consumed_at AS "consumedAt", result_reference AS "resultReference"
      FROM session_generation_review_snapshots
      WHERE id = ${attemptScope.id}
        AND user_id = ${attemptScope.userId}
        AND team_id = ${attemptScope.teamId}
        AND group_training_plan_id = ${attemptScope.groupTrainingPlanId}
      FOR UPDATE
    `
    const row = rows[0]
    if (!row) return { kind: 'unavailable' }

    if (row.status === 'consumed') {
      if (!row.resultReference || !row.consumedAt) {
        throw new Error('Snapshot consumed without durable result reference')
      }
      return { kind: 'already_consumed', resultReference: row.resultReference }
    }

    if (row.status !== 'active' || new Date(row.expiresAt).getTime() <= Date.parse(now)) {
      return { kind: 'unavailable' }
    }

    const claimed = await tx<{ id: string }[]>`
      UPDATE session_generation_review_snapshots
      SET status = 'consumed', consumed_at = ${now}
      WHERE id = ${attemptScope.id}
        AND user_id = ${attemptScope.userId}
        AND team_id = ${attemptScope.teamId}
        AND group_training_plan_id = ${attemptScope.groupTrainingPlanId}
        AND status = 'active' AND expires_at > ${now}
        AND consumed_at IS NULL AND result_reference IS NULL
      RETURNING id
    `
    if (claimed.length !== 1) return { kind: 'unavailable' }

    // Any exception (including an invalid result) rolls back the claim and all
    // writes made through tx by persist.
    const resultReference = await persist(tx, row)
    if (typeof resultReference !== 'string' || resultReference.trim().length === 0) {
      throw new Error('Snapshot persist must return a durable result reference')
    }

    const completed = await tx<{ id: string }[]>`
      UPDATE session_generation_review_snapshots
      SET result_reference = ${resultReference}
      WHERE id = ${attemptScope.id}
        AND user_id = ${attemptScope.userId}
        AND team_id = ${attemptScope.teamId}
        AND group_training_plan_id = ${attemptScope.groupTrainingPlanId}
        AND status = 'consumed' AND consumed_at = ${now}
        AND result_reference IS NULL
      RETURNING id
    `
    if (completed.length !== 1) {
      throw new Error('Snapshot consumption result could not be recorded')
    }

    return { kind: 'consumed', resultReference }
      })
    } catch (error) {
      if (!retryableTransactionFailure(error)) {
        // Known shared-event key collisions require a fresh reconciliation
        // decision by the caller. Never count an unrelated 23505 as success
        // or blindly retry it with stale state.
        if (postgresSqlState(error) === '23505' &&
          error && typeof error === 'object' && 'constraint_name' in error &&
          error.constraint_name === 'sessions_shared_event_key_unique') {
          throw new Error(
            'reconciliation_conflict: sessions_shared_event_key_unique',
            { cause: error },
          )
        }
        throw error
      }
      if (attempt === MAX_CONFIRM_ATTEMPTS) {
        throw new Error('reconciliation_conflict: PostgreSQL serializable retry budget exhausted', {
          cause: error,
        })
      }
    }
  }
  throw new Error('reconciliation_conflict: PostgreSQL confirmation exhausted')
}

/**
 * Explicit scoped invalidation of one active, non-expired PG review snapshot.
 * Atomic UPDATE races safely with consume's row lock; consumed evidence and
 * durable result references remain immutable.
 */
export async function invalidateReviewSnapshotPostgres(
  client: PostgresClient,
  scope: SnapshotScope,
  nowIso: string,
): Promise<boolean> {
  const now = canonicalTime(nowIso)
  const updated = await client<{ id: string }[]>`
    UPDATE session_generation_review_snapshots
    SET status = 'invalidated'
    WHERE id = ${scope.id}
      AND user_id = ${scope.userId}
      AND team_id = ${scope.teamId}
      AND group_training_plan_id = ${scope.groupTrainingPlanId}
      AND status = 'active' AND expires_at > ${now}
      AND consumed_at IS NULL AND result_reference IS NULL
    RETURNING id
  `
  return updated.length === 1
}

/**
 * Explicit maintenance-only purge, independent from review GET and confirmation.
 * Consumed results and any recorded consumption evidence are never deleted.
 * The caller chooses the retention cutoff; this adapter does not schedule jobs.
 */
export async function purgeReviewSnapshotsPostgres(
  client: PostgresClient,
  cutoffIso: string,
  scope: Pick<SnapshotScope, 'userId' | 'teamId' | 'groupTrainingPlanId'>,
): Promise<number> {
  const cutoff = canonicalTime(cutoffIso)
  if (!scope?.userId || !scope.teamId || !scope.groupTrainingPlanId) {
    throw new Error('Snapshot purge requires explicit owner/team/plan scope')
  }
  const rows = await client<{ id: string }[]>`
    DELETE FROM session_generation_review_snapshots
    WHERE user_id = ${scope.userId}
      AND team_id = ${scope.teamId}
      AND group_training_plan_id = ${scope.groupTrainingPlanId}
      AND status IN ('expired', 'invalidated')
      AND expires_at <= ${cutoff}
      AND consumed_at IS NULL
      AND result_reference IS NULL
    RETURNING id
  `
  return rows.length
}
