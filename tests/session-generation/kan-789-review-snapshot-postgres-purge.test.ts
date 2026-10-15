import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import {
  createReviewSnapshotPostgres,
  purgeReviewSnapshotsPostgres,
} from '@/lib/session-generation/review-snapshot-postgres-repository'

const url = process.env.KAN789_PG_URL
if (url) {
  const target = new URL(url)
  if (target.hostname !== '127.0.0.1' || target.port !== '55439' ||
      target.pathname !== '/kan789_acceptance') {
    throw new Error('KAN789 purge acceptance forbids non-disposable PostgreSQL targets')
  }
}

const prefix = 'kan789-pg-purge'
const owner = {
  userId: prefix + '-user',
  teamId: prefix + '-team',
  groupTrainingPlanId: prefix + '-plan',
}
const start = '2026-10-13T12:00:00.000Z'
const cutoff = '2026-10-13T13:00:00.000Z'

test('KAN-789 PostgreSQL maintenance purge is bounded, idempotent and preserves consumed references', { skip: !url }, async () => {
  const sql = postgres(url!, { max: 1, prepare: false })
  try {
    const identity = await sql<{ db: string }[]>`SELECT current_database() AS db`
    assert.equal(identity[0]?.db, 'kan789_acceptance')

    await sql`INSERT INTO users (id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${owner.userId},${owner.userId},${prefix + '@example.invalid'},
        'KAN789','Fixture',${start},${start})`
    await sql`INSERT INTO teams (id, name, created_at, updated_at)
      VALUES (${owner.teamId}, 'KAN-789 purge disposable', ${start}, ${start})`
    await sql`INSERT INTO athlete_groups (id, team_id, category_code, level_code, created_at, updated_at)
      VALUES (${prefix + '-group'}, ${owner.teamId}, 'trail', 'beginner', ${start}, ${start})`
    await sql`INSERT INTO group_training_plans (id, group_id, title, created_at, updated_at)
      VALUES (${owner.groupTrainingPlanId}, ${prefix + '-group'}, 'PG purge fixture', ${start}, ${start})`

    for (const [id, status] of [
      ['expired', 'expired'], ['invalidated', 'invalidated'],
      ['consumed', 'consumed'], ['active', 'active'],
    ] as const) {
      await createReviewSnapshotPostgres(sql, {
        ...owner, id: prefix + '-' + id,
        groupId: prefix + '-group', planningCohortId: null,
        schemaVersion: '1', generatorVersion: '1',
        proposal: { sessions: [{ id }] },
        generationExplanations: { [id]: { stage: 'test' } },
        sourceManifest: { revision: 'r1' },
        sessionCount: 1, microcycleCount: 1,
      }, start)
      if (status === 'consumed') {
        await sql`UPDATE session_generation_review_snapshots
          SET status = 'consumed', consumed_at = ${start}, result_reference = 'result-1'
          WHERE id = ${prefix + '-' + id}`
      } else if (status !== 'active') {
        await sql`UPDATE session_generation_review_snapshots
          SET status = ${status} WHERE id = ${prefix + '-' + id}`
      }
    }

    const rows = async () => {
      const result = await sql<{ id: string; status: string; result_reference: string | null }[]>`
        SELECT id, status, result_reference
        FROM session_generation_review_snapshots
        WHERE group_training_plan_id = ${owner.groupTrainingPlanId}
        ORDER BY id`
      return result.map(({ id, status, result_reference }) => ({ id, status, result_reference }))
    }
    const before = await rows()
    assert.equal(before.length, 4)

    await assert.rejects(purgeReviewSnapshotsPostgres(sql, 'invalid-date', owner), /snapshot.*time|canonical/i)
    assert.deepEqual(await rows(), before)
    assert.equal(await purgeReviewSnapshotsPostgres(sql, start, owner), 0)
    assert.deepEqual(await rows(), before)

    assert.equal(await purgeReviewSnapshotsPostgres(sql, cutoff, owner), 2)
    assert.deepEqual(await rows(), [
      { id: prefix + '-active', status: 'active', result_reference: null },
      { id: prefix + '-consumed', status: 'consumed', result_reference: 'result-1' },
    ])
    assert.equal(await purgeReviewSnapshotsPostgres(sql, cutoff, owner), 0)
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
