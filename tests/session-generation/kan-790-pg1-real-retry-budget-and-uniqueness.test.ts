import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import {
  createReviewSnapshotPostgres,
  consumeReviewSnapshotPostgres,
} from '@/lib/session-generation/review-snapshot-postgres-repository'

const url = process.env.KAN789_PG_URL
if (!url) throw new Error('BLOCKED: KAN789_PG_URL required')
{
  const target = new URL(url)
  if (target.hostname !== '127.0.0.1' || target.port !== '55439' ||
    target.pathname !== '/kan791_regression_disposable') {
    throw new Error('KAN-790 PG-1 retry tests forbid non-disposable PostgreSQL targets')
  }
}
const now = '2026-10-14T21:30:00.000Z'

async function withDisposableSnapshot(
  suffix: string,
  run: (sql: ReturnType<typeof postgres>, scope: {
    id: string; userId: string; teamId: string; groupTrainingPlanId: string
  }, prefix: string) => Promise<void>,
) {
  const prefix = 'kan790-pg1-' + suffix
  const sql = postgres(url!, { max: 1, prepare: false })
  const scope = {
    id: prefix + '-snapshot', userId: prefix + '-user',
    teamId: prefix + '-team', groupTrainingPlanId: prefix + '-plan',
  }
  try {
    const current = await sql<{ db: string }[]>`SELECT current_database() AS db`
    assert.equal(current[0]?.db, 'kan791_regression_disposable')
    await sql`INSERT INTO users
      (id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${scope.userId},${scope.userId},${prefix + '@example.invalid'},'PG-1','Only',${now},${now})`
    await sql`INSERT INTO teams (id,name,created_at,updated_at)
      VALUES (${scope.teamId},'PG-1 disposable',${now},${now})`
    await sql`INSERT INTO athlete_groups
      (id,team_id,category_code,level_code,created_at,updated_at)
      VALUES (${prefix + '-group'},${scope.teamId},'trail','beginner',${now},${now})`
    await sql`INSERT INTO group_training_plans
      (id,group_id,title,created_at,updated_at)
      VALUES (${scope.groupTrainingPlanId},${prefix + '-group'},'PG-1 test',${now},${now})`
    await createReviewSnapshotPostgres(sql, {
      ...scope, groupId: prefix + '-group', planningCohortId: null,
      schemaVersion: '1', generatorVersion: '1',
      proposal: { events: [{ sharedEventKey: prefix, prescriptions: [] }] },
      generationExplanations: {}, sourceManifest: { source: 'pg1' },
      sessionCount: 1, microcycleCount: 0,
    }, now)
    await sql`CREATE TEMP TABLE kan790_pg1_attempt_log (attempt integer PRIMARY KEY)`
    await run(sql, scope, prefix)
  } finally {
    try {
      await sql`DELETE FROM session_generation_review_snapshots WHERE id = ${scope.id}`
      await sql`DELETE FROM sessions WHERE id LIKE ${prefix + '-%'}`
      await sql`DELETE FROM group_training_plans WHERE id = ${scope.groupTrainingPlanId}`
      await sql`DELETE FROM athlete_groups WHERE id = ${prefix + '-group'}`
      await sql`DELETE FROM teams WHERE id = ${scope.teamId}`
      await sql`DELETE FROM users WHERE id = ${scope.userId}`
    } finally {
      await sql.end()
    }
  }
}

test('KAN-790 PG-1 real 40001 exhausts exactly three fresh SERIALIZABLE transactions with full rollback', {}, async () => {
  await withDisposableSnapshot('exhaust', async (sql, scope) => {
    let attempts = 0
    await assert.rejects(
      consumeReviewSnapshotPostgres(sql, scope, now, async tx => {
        attempts++
        const isolation = await tx<{ transaction_isolation: string }[]>`SHOW transaction_isolation`
        assert.equal(isolation[0]?.transaction_isolation, 'serializable')
        await tx`INSERT INTO kan790_pg1_attempt_log (attempt) VALUES (${attempts})`
        await tx`DO $$ BEGIN RAISE EXCEPTION 'forced serialization failure'
          USING ERRCODE = '40001'; END $$`
        return 'unreachable'
      }),
      /reconciliation_conflict: PostgreSQL serializable retry budget exhausted/,
    )
    assert.equal(attempts, 3)
    const logs = await sql<{ count: number }[]>`SELECT count(*)::integer AS count FROM kan790_pg1_attempt_log`
    assert.equal(logs[0]?.count, 0, 'no writes from failed attempts may survive')
    const state = await sql<{ status: string; result_reference: string | null }[]>`
      SELECT status, result_reference FROM session_generation_review_snapshots WHERE id = ${scope.id}`
    assert.deepEqual(state[0], { status: 'active', result_reference: null })
  })
})

test('KAN-790 PG-1 real 40P01 opens a new transaction and commits only the last attempt', {}, async () => {
  await withDisposableSnapshot('deadlock', async (sql, scope) => {
    let attempts = 0
    const result = await consumeReviewSnapshotPostgres(sql, scope, now, async tx => {
      attempts++
      await tx`INSERT INTO kan790_pg1_attempt_log (attempt) VALUES (${attempts})`
      if (attempts < 3) {
        await tx`DO $$ BEGIN RAISE EXCEPTION 'forced deadlock'
          USING ERRCODE = '40P01'; END $$`
      }
      return scope.groupTrainingPlanId
    })
    assert.deepEqual(result, { kind: 'consumed', resultReference: scope.groupTrainingPlanId })
    assert.equal(attempts, 3)
    const logs = await sql<{ attempt: number }[]>`SELECT attempt FROM kan790_pg1_attempt_log`
    assert.deepEqual(Array.from(logs), [{ attempt: 3 }])
  })
})

test('KAN-790 PG-1 real 23505 shared-event constraint is classified as conflict, never silent success or generic retry', {}, async () => {
  await withDisposableSnapshot('unique', async (sql, scope, prefix) => {
    const sharedEventKey = prefix + '-shared'
    await sql`INSERT INTO sessions
      (id,team_id,date,title,type,generation_ownership,shared_event_key,created_at,updated_at)
      VALUES (${prefix + '-existing'},${scope.teamId},'2027-01-05','existing','Trail',
        'generated',${sharedEventKey},${now},${now})`
    let attempts = 0
    await assert.rejects(
      consumeReviewSnapshotPostgres(sql, scope, now, async tx => {
        attempts++
        await tx`INSERT INTO sessions
          (id,team_id,date,title,type,generation_ownership,shared_event_key,created_at,updated_at)
          VALUES (${prefix + '-duplicate'},${scope.teamId},'2027-01-05','duplicate','Trail',
            'generated',${sharedEventKey},${now},${now})`
        return 'must-not-consume'
      }),
      /reconciliation_conflict:.*sessions_shared_event_key_unique/,
    )
    assert.equal(attempts, 1, '23505 must not be blindly retried')
    const rows = await sql<{ id: string }[]>`
      SELECT id FROM sessions WHERE shared_event_key = ${sharedEventKey}`
    assert.deepEqual(Array.from(rows), [{ id: prefix + '-existing' }])
    const state = await sql<{ status: string; result_reference: string | null }[]>`
      SELECT status, result_reference FROM session_generation_review_snapshots WHERE id = ${scope.id}`
    assert.deepEqual(state[0], { status: 'active', result_reference: null })
  })
})
