import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import {
  createReviewSnapshotPostgres,
  getActiveReviewSnapshotPostgres,
} from '@/lib/session-generation/review-snapshot-postgres-repository'

const url = process.env.KAN789_PG_URL
if (!url) throw new Error('BLOCKED: KAN789_PG_URL required')
{
  const target = new URL(url)
  if (target.hostname !== '127.0.0.1' || target.port !== '55439' ||
      target.pathname !== '/kan791_regression_disposable') {
    throw new Error('KAN789 replacement test forbids non-disposable PostgreSQL targets')
  }
}

const prefix = 'kan789-pg-replacement'
const owner = {
  userId: prefix + '-user',
  teamId: prefix + '-team',
  groupTrainingPlanId: prefix + '-plan',
}
const firstTime = '2026-10-13T12:00:00.000Z'
const secondTime = '2026-10-13T12:01:00.000Z'
const now = '2026-10-13T12:02:00.000Z'
const scope = (id: string) => ({ ...owner, id: prefix + '-' + id })
const input = (id: string, replaceSnapshotId?: string) => ({
  ...scope(id),
  groupId: prefix + '-group',
  planningCohortId: null,
  schemaVersion: '1',
  generatorVersion: '1',
  proposal: { sessions: [{ id: 's1' }] },
  generationExplanations: { s1: { stage: 'test' } },
  sourceManifest: { revision: 'r1' },
  sessionCount: 1,
  microcycleCount: 1,
  replaceSnapshotId,
})

test('KAN-789 PostgreSQL explicitly replaces only oldest scoped active snapshot', {}, async () => {
  const sql = postgres(url!, { max: 1, prepare: false })
  try {
    const identity = await sql<{ db: string }[]>`SELECT current_database() AS db`
    assert.equal(identity[0]?.db, 'kan791_regression_disposable')
    await sql`INSERT INTO users (id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${owner.userId},${owner.userId},${prefix + '@example.invalid'},
        'KAN789','Fixture',${firstTime},${firstTime})`
    await sql`INSERT INTO teams (id, name, created_at, updated_at)
      VALUES (${owner.teamId}, 'KAN-789 disposable replacement', ${now}, ${now})`
    await sql`INSERT INTO athlete_groups
      (id, team_id, category_code, level_code, created_at, updated_at)
      VALUES (${prefix + '-group'}, ${owner.teamId}, 'trail', 'beginner', ${now}, ${now})`
    await sql`INSERT INTO group_training_plans
      (id, group_id, title, created_at, updated_at)
      VALUES (${owner.groupTrainingPlanId}, ${prefix + '-group'}, 'Replacement fixture', ${now}, ${now})`

    await createReviewSnapshotPostgres(sql, input('first'), firstTime)
    await createReviewSnapshotPostgres(sql, input('second'), secondTime)

    await assert.rejects(createReviewSnapshotPostgres(sql, input('third'), now), /snapshot.*quota/i)
    await assert.rejects(createReviewSnapshotPostgres(sql, input('third', scope('second').id), now),
      /snapshot.*(replace|oldest|quota)/i)
    await assert.rejects(createReviewSnapshotPostgres(sql, input('third', 'not-found'), now),
      /snapshot.*(replace|oldest|quota)/i)

    const before = await sql<{ id: string; status: string }[]>`
      SELECT id, status FROM session_generation_review_snapshots
      WHERE group_training_plan_id = ${owner.groupTrainingPlanId}
      ORDER BY id`
    assert.deepEqual(before.map(({ id, status }) => ({ id, status })), [
      { id: scope('first').id, status: 'active' },
      { id: scope('second').id, status: 'active' },
    ])

    const created = await createReviewSnapshotPostgres(sql, input('third', scope('first').id), now)
    assert.equal(created.status, 'active')
    assert.equal(await getActiveReviewSnapshotPostgres(sql, scope('first'), now), null)
    assert.equal((await getActiveReviewSnapshotPostgres(sql, scope('second'), now))?.status, 'active')

    const after = await sql<{ id: string; status: string }[]>`
      SELECT id, status FROM session_generation_review_snapshots
      WHERE group_training_plan_id = ${owner.groupTrainingPlanId}
      ORDER BY id`
    assert.deepEqual(after.map(({ id, status }) => ({ id, status })), [
      { id: scope('first').id, status: 'invalidated' },
      { id: scope('second').id, status: 'active' },
      { id: scope('third').id, status: 'active' },
    ])
  } finally {
    try {
      await sql`DELETE FROM session_generation_review_snapshots
        WHERE group_training_plan_id = ${owner.groupTrainingPlanId}`
      await sql`DELETE FROM group_training_plans WHERE id = ${owner.groupTrainingPlanId}`
      await sql`DELETE FROM athlete_groups WHERE id = ${prefix + '-group'}`
      await sql`DELETE FROM teams WHERE id = ${owner.teamId}`
      await sql`DELETE FROM users WHERE id = ${owner.userId}`
    } finally {
      await sql.end()
    }
  }
})
