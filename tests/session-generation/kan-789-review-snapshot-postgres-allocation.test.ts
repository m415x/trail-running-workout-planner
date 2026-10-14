import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import {
  createReviewSnapshotPostgres,
  getActiveReviewSnapshotPostgres,
} from '@/lib/session-generation/review-snapshot-postgres-repository'

const url = process.env.KAN789_PG_URL
if (url) {
  const parsed = new URL(url)
  if (parsed.hostname !== '127.0.0.1' || parsed.port !== '55439' ||
    parsed.pathname !== '/kan789_acceptance') {
    throw new Error('KAN789_PG_URL must address disposable PostgreSQL 127.0.0.1:55439/kan789_acceptance')
  }
}

const now = '2026-10-13T12:00:00.000Z'
const marker = 'kan789-pg-lifecycle'
const scope = { userId: 'kan789-h7a-user', teamId: 'kan789-h7a-team',
  groupTrainingPlanId: marker + '-plan' }

test('KAN-789 PostgreSQL allocation has scoped reads, 30-minute TTL and atomic quota', { skip: !url }, async () => {
  const sql = postgres(url!, { max: 1, prepare: false })
  try {
    const identity = await sql<{ database: string }[]>`SELECT current_database() AS database`
    assert.equal(identity[0]?.database, 'kan789_acceptance')
    await sql`INSERT INTO athlete_groups (id, team_id, category_code, level_code, created_at, updated_at)
      VALUES (${marker + '-group'}, ${scope.teamId}, 'trail', 'beginner', ${now}, ${now})`
    await sql`INSERT INTO group_training_plans (id, group_id, title, created_at, updated_at)
      VALUES (${scope.groupTrainingPlanId}, ${marker + '-group'}, 'Snapshot review fixture', ${now}, ${now})`

    const input = (id: string) => ({
      ...scope, id, groupId: marker + '-group', planningCohortId: null,
      schemaVersion: '1', generatorVersion: '1',
      proposal: { sessions: [{ id: 's1' }] },
      generationExplanations: { s1: { stage: 'test' } },
      sourceManifest: { revision: 'r1' },
      sessionCount: 1, microcycleCount: 1,
    })

    const a = await createReviewSnapshotPostgres(sql, input(marker + '-a'), now)
    const b = await createReviewSnapshotPostgres(sql, input(marker + '-b'), now)
    assert.equal(a.status, 'active')
    assert.equal(b.expiresAt, '2026-10-13T12:30:00.000Z')
    await assert.rejects(
      createReviewSnapshotPostgres(sql, input(marker + '-c'), now),
      /snapshot.*(quota|active|limit)/i,
    )
    const rows = await sql<{ count: string }[]>`SELECT count(*)::text AS count FROM session_generation_review_snapshots
      WHERE group_training_plan_id = ${scope.groupTrainingPlanId}`
    assert.equal(rows[0]?.count, '2')
    assert.equal((await getActiveReviewSnapshotPostgres(sql, input(marker + '-a'), now))?.id, marker + '-a')
    assert.equal(await getActiveReviewSnapshotPostgres(sql, { ...input(marker + '-a'), userId: 'wrong' }, now), null)

    const future = '2026-10-13T12:31:00.000Z'
    assert.equal(await getActiveReviewSnapshotPostgres(sql, input(marker + '-a'), future), null)
    await createReviewSnapshotPostgres(sql, input(marker + '-c'), future)
    const active = await sql<{ count: string }[]>`SELECT count(*)::text AS count FROM session_generation_review_snapshots
      WHERE group_training_plan_id = ${scope.groupTrainingPlanId} AND status = 'active'`
    assert.equal(active[0]?.count, '1')
  } finally {
    await sql`DELETE FROM session_generation_review_snapshots WHERE group_training_plan_id = ${scope.groupTrainingPlanId}`
    await sql`DELETE FROM group_training_plans WHERE id = ${scope.groupTrainingPlanId}`
    await sql`DELETE FROM athlete_groups WHERE id = ${marker + '-group'}`
    await sql.end()
  }
})
