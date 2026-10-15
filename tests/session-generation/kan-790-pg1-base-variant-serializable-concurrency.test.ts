import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import {
  createReviewSnapshotPostgres,
  consumeReviewSnapshotPostgres,
} from '@/lib/session-generation/review-snapshot-postgres-repository'

// Runs only against the already-established disposable KAN-789 target.
// An absent URL is a SKIP, NEVER evidence of PostgreSQL GREEN.
const url = process.env.KAN789_PG_URL
if (url) {
  const target = new URL(url)
  if (target.hostname !== '127.0.0.1' || target.port !== '55439' ||
    target.pathname !== '/kan789_acceptance') {
    throw new Error('KAN-790 PG-1 test forbids non-disposable PostgreSQL targets')
  }
}

const prefix = 'kan790-pg1-variant'
const now = '2026-10-14T21:30:00.000Z'
const userId = prefix + '-user'
const teamId = prefix + '-team'
const groupId = prefix + '-group'
const plans = [prefix + '-base', prefix + '-variant'] as const
const cohortId = prefix + '-cohort'
const snapshots = [prefix + '-snapshot-a', prefix + '-snapshot-b'] as const
const sharedKey = prefix + '-shared-event'

test('KAN-790 PG-1 canonical Base/Variant snapshots concurrently share Session with SERIALIZABLE retries', { skip: !url, timeout: 30_000 }, async () => {
  const setup = postgres(url!, { max: 1, prepare: false })
  const clients = [
    postgres(url!, { max: 1, prepare: false }),
    postgres(url!, { max: 1, prepare: false }),
  ]
  try {
    const database = await setup<{ name: string }[]>`SELECT current_database() AS name`
    assert.equal(database[0]?.name, 'kan789_acceptance')
    const pids = await Promise.all(clients.map(async client =>
      (await client<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`)[0].pid))
    assert.equal(new Set(pids).size, 2, 'must use distinct PostgreSQL connections')

    await setup`INSERT INTO users
      (id, user_name, email, first_name, last_name, created_at, updated_at)
      VALUES (${userId}, ${prefix + '-user'}, ${prefix + '@example.invalid'},
        'PG-1', 'Disposable', ${now}, ${now})`
    await setup`INSERT INTO teams (id,name,created_at,updated_at)
      VALUES (${teamId},'PG-1 disposable',${now},${now})`
    await setup`INSERT INTO athlete_groups (id,team_id,category_code,level_code,created_at,updated_at)
      VALUES (${groupId},${teamId},'trail','beginner',${now},${now})`
    await setup`INSERT INTO group_training_plans (id,group_id,title,created_at,updated_at)
      VALUES (${plans[0]},${groupId},'PG-1 Base',${now},${now})`
    await setup`INSERT INTO planning_cohorts
      (id,team_id,group_id,name,purpose,created_at,updated_at)
      VALUES (${cohortId},${teamId},${groupId},'PG-1 Variant','specific',${now},${now})`
    await setup`INSERT INTO group_training_plans
      (id,group_id,planning_cohort_id,source_group_training_plan_id,title,created_at,updated_at)
      VALUES (${plans[1]},${groupId},${cohortId},${plans[0]},'PG-1 Variant',${now},${now})`
    const lineage = await setup<{ planning_cohort_id: string | null; source_group_training_plan_id: string | null }[]>`
      SELECT planning_cohort_id, source_group_training_plan_id
      FROM group_training_plans WHERE id = ${plans[1]}`
    assert.deepEqual({ planningCohortId: lineage[0]?.planning_cohort_id,
      source: lineage[0]?.source_group_training_plan_id },
    { planningCohortId: cohortId, source: plans[0] })
    await setup`INSERT INTO sessions
      (id,team_id,date,title,type,generation_ownership,shared_event_key,created_at,updated_at)
      VALUES (${prefix + '-session'},${teamId},'2027-01-05','PG-1 shared','Trail','generated',${sharedKey},${now},${now})`

    for (let i = 0; i < snapshots.length; i++) {
      await createReviewSnapshotPostgres(setup, {
        id: snapshots[i], userId,
        teamId, groupTrainingPlanId: plans[i], groupId,
        planningCohortId: i === 1 ? cohortId : null, schemaVersion: '1', generatorVersion: '1',
        proposal: { events: [{ sharedEventKey: sharedKey, prescriptions: [] }] },
        generationExplanations: {}, sourceManifest: { revision: 'pg1' },
        sessionCount: 1, microcycleCount: 0,
      }, now)
    }

    // Force both transactions to read the same initial Session before either
    // attempts its update. Retries (if needed) must re-read inside NEW tx.
    let entered = 0
    let release!: () => void
    const bothEntered = new Promise<void>(resolve => { release = resolve })
    const isolation: string[] = []
    const attempts = [0, 0]
    const confirm = (i: number) => consumeReviewSnapshotPostgres(
      clients[i], {
        id: snapshots[i], userId,
        teamId, groupTrainingPlanId: plans[i],
      }, now, async tx => {
        attempts[i]++
        const levels = await tx<{ transaction_isolation: string }[]>`SHOW transaction_isolation`
        isolation.push(levels[0]?.transaction_isolation)
        const rows = await tx<{ title: string }[]>`
          SELECT title FROM sessions WHERE shared_event_key = ${sharedKey}`
        assert.equal(rows.length, 1)
        if (attempts[i] === 1) {
          entered++
          if (entered === 2) release()
          await bothEntered
        }
        await tx`UPDATE sessions SET title = ${'confirmed-' + i},
          updated_at = ${now} WHERE shared_event_key = ${sharedKey}`
        return plans[i]
      },
    )

    const outcomes = await Promise.all([confirm(0), confirm(1)])
    assert.deepEqual(outcomes.map(x => x.kind), ['consumed', 'consumed'])
    assert.ok(attempts.some(value => value > 1),
      'one overlapping transaction must retry after serialization conflict')
    assert.ok(isolation.length >= 2)
    assert.ok(isolation.every(level => level === 'serializable'),
      'every attempt, including retries, must be SERIALIZABLE')
    const rows = await setup<{ status: string; result_reference: string | null }[]>`
      SELECT status, result_reference FROM session_generation_review_snapshots
      WHERE id IN ${setup(snapshots)} ORDER BY id`
    assert.equal(rows.length, 2)
    assert.ok(rows.every(row => row.status === 'consumed' && row.result_reference !== null))
    for (let i = 0; i < 2; i++) {
      assert.deepEqual(await consumeReviewSnapshotPostgres(clients[i], {
        id: snapshots[i], userId,
        teamId, groupTrainingPlanId: plans[i],
      }, now, async () => { throw new Error('idempotent retry must not write') }),
      { kind: 'already_consumed', resultReference: plans[i] })
    }
  } finally {
    await Promise.all(clients.map(c => c.end()))
    try {
      await setup`DELETE FROM session_generation_review_snapshots WHERE id IN ${setup(snapshots)}`
      await setup`DELETE FROM sessions WHERE shared_event_key = ${sharedKey}`
      await setup`DELETE FROM group_training_plans WHERE id = ${plans[1]}`
      await setup`DELETE FROM planning_cohorts WHERE id = ${cohortId}`
      await setup`DELETE FROM group_training_plans WHERE id = ${plans[0]}`
      await setup`DELETE FROM athlete_groups WHERE id = ${groupId}`
      await setup`DELETE FROM teams WHERE id = ${teamId}`
      await setup`DELETE FROM users WHERE id = ${userId}`
    } finally {
      await setup.end()
    }
  }
})
