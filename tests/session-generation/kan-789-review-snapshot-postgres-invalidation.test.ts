import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import {
  createReviewSnapshotPostgres,
  consumeReviewSnapshotPostgres,
  getActiveReviewSnapshotPostgres,
  invalidateReviewSnapshotPostgres,
} from '@/lib/session-generation/review-snapshot-postgres-repository'

const url = process.env.KAN789_PG_URL
if (!url) throw new Error('BLOCKED: KAN789_PG_URL required')
{
  const target = new URL(url)
  if (target.hostname !== '127.0.0.1' || target.port !== '55439' ||
      target.pathname !== '/kan791_regression_disposable') {
    throw new Error('KAN789 invalidation test forbids non-disposable PostgreSQL targets')
  }
}

const now = '2026-10-13T12:00:00.000Z'
const prefix = 'kan789-pg-invalidation'
const owner = {
  userId: prefix + '-user',
  teamId: prefix + '-team',
  groupTrainingPlanId: prefix + '-plan',
}
const scope = (id: string) => ({ ...owner, id: prefix + '-' + id })

test('KAN-789 PG invalidation scopes owner, preserves consumption and blocks reuse', {}, async () => {
  const sql = postgres(url!, { max: 1, prepare: false })
  try {
    const identity = await sql<{ db: string }[]>`SELECT current_database() AS db`
    assert.equal(identity[0]?.db, 'kan791_regression_disposable')
    await sql`INSERT INTO users (id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${owner.userId},${owner.userId},${prefix + '@example.invalid'},
        'KAN789','Fixture',${now},${now})`
    await sql`INSERT INTO teams (id, name, created_at, updated_at)
      VALUES (${prefix + '-team'}, 'KAN-789 PostgreSQL disposable fixture', ${now}, ${now})`
    await sql`INSERT INTO athlete_groups
      (id, team_id, category_code, level_code, created_at, updated_at)
      VALUES (${prefix + '-group'}, ${owner.teamId}, 'trail', 'beginner', ${now}, ${now})`
    await sql`INSERT INTO group_training_plans
      (id, group_id, title, created_at, updated_at)
      VALUES (${owner.groupTrainingPlanId}, ${prefix + '-group'}, 'PG invalidate fixture', ${now}, ${now})`

    const input = (id: string) => ({
      ...scope(id), groupId: prefix + '-group', planningCohortId: null,
      schemaVersion: '1', generatorVersion: '1',
      proposal: { sessions: [{ id: 's1' }] },
      generationExplanations: { s1: { stage: 'test' } },
      sourceManifest: { revision: 'r1' },
      sessionCount: 1, microcycleCount: 1,
    })

    await createReviewSnapshotPostgres(sql, input('active'), now)
    await createReviewSnapshotPostgres(sql, input('consumed'), now)

    assert.equal(await invalidateReviewSnapshotPostgres(
      sql, { ...scope('active'), userId: 'wrong-user' }, now,
    ), false)
    assert.equal((await getActiveReviewSnapshotPostgres(sql, scope('active'), now))?.status, 'active')

    assert.equal(await invalidateReviewSnapshotPostgres(sql, scope('active'), now), true)
    assert.equal(await invalidateReviewSnapshotPostgres(sql, scope('active'), now), false)
    assert.equal(await getActiveReviewSnapshotPostgres(sql, scope('active'), now), null)

    let calls = 0
    assert.deepEqual(await consumeReviewSnapshotPostgres(sql, scope('active'), now, async () => {
      calls++
      return 'should-not-write'
    }), { kind: 'unavailable' })
    assert.equal(calls, 0)

    assert.deepEqual(await consumeReviewSnapshotPostgres(
      sql, scope('consumed'), now, async () => 'result-1',
    ), { kind: 'consumed', resultReference: 'result-1' })
    assert.equal(await invalidateReviewSnapshotPostgres(sql, scope('consumed'), now), false)

    const rows = await sql<{
      id: string; status: string; consumed_at: string | null; result_reference: string | null
    }[]>`SELECT id, status, consumed_at, result_reference
      FROM session_generation_review_snapshots
      WHERE group_training_plan_id = ${owner.groupTrainingPlanId} ORDER BY id`
    assert.deepEqual(rows.map(row => ({
      id: row.id,
      status: row.status,
      consumedAt: row.consumed_at ? new Date(row.consumed_at).toISOString() : null,
      resultReference: row.result_reference,
    })), [
      { id: prefix + '-active', status: 'invalidated', consumedAt: null, resultReference: null },
      { id: prefix + '-consumed', status: 'consumed', consumedAt: now, resultReference: 'result-1' },
    ])
    assert.deepEqual(await consumeReviewSnapshotPostgres(
      sql, scope('consumed'), now, async () => { throw new Error('must not re-persist') },
    ), { kind: 'already_consumed', resultReference: 'result-1' })
  } finally {
    await sql`DELETE FROM session_generation_review_snapshots
      WHERE group_training_plan_id = ${owner.groupTrainingPlanId}`
    await sql`DELETE FROM group_training_plans WHERE id = ${owner.groupTrainingPlanId}`
    await sql`DELETE FROM athlete_groups WHERE id = ${prefix + '-group'}`
      await sql`DELETE FROM teams WHERE id = ${prefix + '-team'}`
      await sql`DELETE FROM users WHERE id = ${owner.userId}`
    await sql.end()
  }
})
