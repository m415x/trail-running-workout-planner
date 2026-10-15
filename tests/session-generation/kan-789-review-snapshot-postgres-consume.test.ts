import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import {
  createReviewSnapshotPostgres,
  consumeReviewSnapshotPostgres,
} from '@/lib/session-generation/review-snapshot-postgres-repository'

// KAN-789 tests may touch ONLY the disposable, explicitly selected database.
const url = process.env.KAN789_PG_URL
if (url) {
  const target = new URL(url)
  if (target.hostname !== '127.0.0.1' || target.port !== '55439' ||
      target.pathname !== '/kan789_acceptance') {
    throw new Error('KAN789 PostgreSQL acceptance forbids non-disposable targets')
  }
}

const now = '2026-10-13T12:00:00.000Z'
const prefix = 'kan789-pg-consume'
const scope = {
  id: prefix + '-snapshot',
  userId: prefix + '-user',
  teamId: prefix + '-team',
  groupTrainingPlanId: prefix + '-plan',
}

test('KAN-789 PG consume is atomic, scoped, rollback-safe and idempotent', { skip: !url }, async () => {
  const sql = postgres(url!, { max: 1, prepare: false })
  try {
    const identity = await sql<{ db: string }[]>`SELECT current_database() AS db`
    assert.equal(identity[0]?.db, 'kan789_acceptance')

    await sql`INSERT INTO users (id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${scope.userId},${scope.userId},${prefix + '@example.invalid'},
        'KAN789','Fixture',${now},${now})`
    await sql`INSERT INTO teams (id, name, created_at, updated_at)
      VALUES (${prefix + '-team'}, 'KAN-789 PostgreSQL disposable fixture', ${now}, ${now})`
    await sql`INSERT INTO athlete_groups
      (id, team_id, category_code, level_code, created_at, updated_at)
      VALUES (${prefix + '-group'}, ${scope.teamId}, 'trail', 'beginner', ${now}, ${now})`
    await sql`INSERT INTO group_training_plans
      (id, group_id, title, created_at, updated_at)
      VALUES (${scope.groupTrainingPlanId}, ${prefix + '-group'}, 'PG consume fixture', ${now}, ${now})`
    await sql`CREATE TEMP TABLE kan789_pg_committed_generation
      (id text PRIMARY KEY, result text NOT NULL)`

    await createReviewSnapshotPostgres(sql, {
      ...scope, groupId: prefix + '-group', planningCohortId: null,
      schemaVersion: '1', generatorVersion: '1',
      proposal: { sessions: [{ id: 's1' }] },
      generationExplanations: { s1: { stage: 'test' } },
      sourceManifest: { revision: 'r1' },
      sessionCount: 1, microcycleCount: 1,
    }, now)

    let calls = 0
    const persist = async (tx: postgres.TransactionSql) => {
      calls++
      await tx`INSERT INTO kan789_pg_committed_generation (id, result)
        VALUES ('result-1', 'saved')`
      return 'result-1'
    }

    assert.deepEqual(
      await consumeReviewSnapshotPostgres(sql, { ...scope, userId: 'wrong' }, now, persist),
      { kind: 'unavailable' },
    )
    assert.equal(calls, 0)

    await assert.rejects(
      consumeReviewSnapshotPostgres(sql, scope, now, async (tx: postgres.TransactionSql) => {
        await tx`INSERT INTO kan789_pg_committed_generation (id, result)
          VALUES ('rollback', 'partial')`
        throw new Error('Forced persistence failure')
      }),
      /Forced persistence failure/,
    )
    const rolledBack = await sql<{ total: number }[]>`
      SELECT count(*)::integer AS total FROM kan789_pg_committed_generation`
    assert.equal(rolledBack[0]?.total, 0)
    const pending = await sql<{ status: string; result_reference: string | null }[]>`
      SELECT status, result_reference FROM session_generation_review_snapshots
      WHERE id = ${scope.id}`
    assert.deepEqual(pending[0], { status: 'active', result_reference: null })

    assert.deepEqual(await consumeReviewSnapshotPostgres(sql, scope, now, persist),
      { kind: 'consumed', resultReference: 'result-1' })
    assert.deepEqual(
      await consumeReviewSnapshotPostgres(sql, scope, now, async () => {
        throw new Error('Retry must never persist again')
      }),
      { kind: 'already_consumed', resultReference: 'result-1' },
    )
    assert.equal(calls, 1)
    const evidence = await sql<{ status: string; result_reference: string; consumed_at: string }[]>`
      SELECT status, result_reference, consumed_at
      FROM session_generation_review_snapshots WHERE id = ${scope.id}`
    assert.equal(evidence[0]?.status, 'consumed')
    assert.equal(evidence[0]?.result_reference, 'result-1')
    assert.equal(new Date(evidence[0]?.consumed_at).toISOString(), now)
    const count = await sql<{ total: number }[]>`
      SELECT count(*)::integer AS total FROM kan789_pg_committed_generation`
    assert.equal(count[0]?.total, 1)
  } finally {
    await sql`DELETE FROM session_generation_review_snapshots
      WHERE group_training_plan_id = ${scope.groupTrainingPlanId}`
    await sql`DELETE FROM group_training_plans WHERE id = ${scope.groupTrainingPlanId}`
    await sql`DELETE FROM athlete_groups WHERE id = ${prefix + '-group'}`
      await sql`DELETE FROM teams WHERE id = ${prefix + '-team'}`
      await sql`DELETE FROM users WHERE id = ${scope.userId}`
    await sql.end()
  }
})
