import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import {
  createReviewSnapshotPostgres,
  consumeReviewSnapshotPostgres,
} from '@/lib/session-generation/review-snapshot-postgres-repository'

const url = process.env.KAN789_PG_URL
if (url) {
  const target = new URL(url)
  if (target.hostname !== '127.0.0.1' || target.port !== '55439' ||
      target.pathname !== '/kan789_acceptance') {
    throw new Error('KAN789 concurrency test forbids non-disposable PostgreSQL targets')
  }
}

const prefix = 'kan789-pg-concurrency'
const now = '2026-10-13T12:00:00.000Z'
const owner = {
  userId: prefix + '-user',
  teamId: prefix + '-team',
  groupTrainingPlanId: prefix + '-plan',
}
const input = (id: string) => ({
  ...owner, id: prefix + '-' + id,
  groupId: prefix + '-group', planningCohortId: null,
  schemaVersion: '1', generatorVersion: '1',
  proposal: { sessions: [{ id: 's1' }] },
  generationExplanations: { s1: { stage: 'test' } },
  sourceManifest: { revision: 'r1' },
  sessionCount: 1, microcycleCount: 1,
})

test('KAN-789 independent PG sessions serialize quota and single consumption', { skip: !url }, async () => {
  // Three distinct physical connections (not merely Promise.all on max:1).
  const setup = postgres(url!, { max: 1, prepare: false })
  const clients = Array.from({ length: 3 }, () => postgres(url!, { max: 1, prepare: false }))
  try {
    const identity = await setup<{ db: string }[]>`SELECT current_database() AS db`
    assert.equal(identity[0]?.db, 'kan789_acceptance')
    const distinctSessions = await Promise.all(clients.map(async client => {
      const result = await client<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`
      return result[0]?.pid
    }))
    assert.equal(new Set(distinctSessions).size, 3, 'Tests must use distinct PG sessions')

    await setup`INSERT INTO users (id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${owner.userId},${owner.userId},${prefix + '@example.invalid'},
        'KAN789','Fixture',${now},${now})`
    await setup`INSERT INTO teams (id, name, created_at, updated_at)
      VALUES (${prefix + '-team'}, 'KAN-789 PostgreSQL disposable fixture', ${now}, ${now})`
    await setup`INSERT INTO athlete_groups
      (id, team_id, category_code, level_code, created_at, updated_at)
      VALUES (${prefix + '-group'}, ${owner.teamId}, 'trail', 'beginner', ${now}, ${now})`
    await setup`INSERT INTO group_training_plans
      (id, group_id, title, created_at, updated_at)
      VALUES (${owner.groupTrainingPlanId}, ${prefix + '-group'}, 'PG concurrency fixture', ${now}, ${now})`

    const concurrent = await Promise.allSettled(
      clients.map((client, i) => createReviewSnapshotPostgres(client, input('allocation-' + i), now)),
    )
    assert.equal(concurrent.filter(x => x.status === 'fulfilled').length, 2,
      'Exactly two independently concurrent allocations should succeed')
    const rejected = concurrent.filter(x => x.status === 'rejected')
    assert.equal(rejected.length, 1)
    assert.match(String(rejected[0]?.status === 'rejected' ? rejected[0].reason : ''),
      /snapshot.*(quota|active|limit)/i)

    const existing = await setup<{ id: string }[]>`
      SELECT id FROM session_generation_review_snapshots
      WHERE group_training_plan_id = ${owner.groupTrainingPlanId}
        AND status = 'active' ORDER BY id`
    assert.equal(existing.length, 2)

    const chosen = { ...owner, id: existing[0].id }
    let durableCalls = 0
    const attempts = await Promise.all(clients.map(client =>
      consumeReviewSnapshotPostgres(client, chosen, now, async () => {
        durableCalls += 1
        return 'shared-durable-result'
      }),
    ))
    assert.equal(attempts.filter(x => x.kind === 'consumed').length, 1)
    assert.equal(attempts.filter(x => x.kind === 'already_consumed').length, 2)
    assert.equal(durableCalls, 1, 'Callback must run once for concurrent same-snapshot attempts')
    assert.ok(attempts.every(x => x.kind !== 'unavailable' &&
      x.resultReference === 'shared-durable-result'))
    const state = await setup<{ status: string; result_reference: string }[]>`
      SELECT status, result_reference FROM session_generation_review_snapshots
      WHERE id = ${chosen.id}`
    assert.equal(state[0]?.status, 'consumed')
    assert.equal(state[0]?.result_reference, 'shared-durable-result')
  } finally {
    await Promise.all(clients.map(c => c.end()))
    try {
      await setup`DELETE FROM session_generation_review_snapshots
        WHERE group_training_plan_id = ${owner.groupTrainingPlanId}`
      await setup`DELETE FROM group_training_plans WHERE id = ${owner.groupTrainingPlanId}`
      await setup`DELETE FROM athlete_groups WHERE id = ${prefix + '-group'}`
      await setup`DELETE FROM teams WHERE id = ${prefix + '-team'}`
      await setup`DELETE FROM users WHERE id = ${owner.userId}`
    } finally {
      await setup.end()
    }
  }
})
