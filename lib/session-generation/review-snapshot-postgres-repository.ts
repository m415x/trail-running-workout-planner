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
