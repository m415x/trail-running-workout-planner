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

interface SnapshotRow {
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

export type ConsumeReviewSnapshotPostgresResult =
  | { readonly kind: 'consumed'; readonly resultReference: string }
  | { readonly kind: 'already_consumed'; readonly resultReference: string }
  | { readonly kind: 'unavailable' }

/**
 * Atomically persists the result and consumes an active snapshot.
 *
 * The callback MUST write using the supplied transaction client. The caller
 * must enforce authenticated H2/H3/H4A ownership and validate source freshness
 * within the appropriate transaction boundary; scoped SQL alone is not auth.
 */
export async function consumeReviewSnapshotPostgres(
  client: PostgresClient,
  scope: SnapshotScope,
  nowIso: string,
  persist: (tx: postgres.TransactionSql, snapshot: SnapshotRow) => Promise<string>,
): Promise<ConsumeReviewSnapshotPostgresResult> {
  const now = canonicalTime(nowIso)

  return client.begin(async (tx): Promise<ConsumeReviewSnapshotPostgresResult> => {
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
      WHERE id = ${scope.id}
        AND user_id = ${scope.userId}
        AND team_id = ${scope.teamId}
        AND group_training_plan_id = ${scope.groupTrainingPlanId}
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
      WHERE id = ${scope.id}
        AND user_id = ${scope.userId}
        AND team_id = ${scope.teamId}
        AND group_training_plan_id = ${scope.groupTrainingPlanId}
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
      WHERE id = ${scope.id}
        AND user_id = ${scope.userId}
        AND team_id = ${scope.teamId}
        AND group_training_plan_id = ${scope.groupTrainingPlanId}
        AND status = 'consumed' AND consumed_at = ${now}
        AND result_reference IS NULL
      RETURNING id
    `
    if (completed.length !== 1) {
      throw new Error('Snapshot consumption result could not be recorded')
    }

    return { kind: 'consumed', resultReference }
  })
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
