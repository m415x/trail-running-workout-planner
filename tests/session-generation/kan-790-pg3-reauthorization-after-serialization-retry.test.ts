import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { createAuthorizedReviewSnapshotPostgresConfirmationOperations } from '@/lib/session-generation/authorized-review-snapshot-postgres-confirmation'

test('KAN-790 PG-3 40001 retry reacquires authorization, then DENY leaves review untouched', async () => {
  const url = process.env.KAN789_PG_URL
  assert.ok(url, 'PostgreSQL disposable connection required; never SKIP')
  const target = new URL(url)
  assert.equal(target.hostname, '127.0.0.1')
  assert.equal(target.port, '55439')
  assert.equal(target.pathname, '/kan789_acceptance')
  const sql = postgres(url, { max: 1, prepare: false })
  const prefix = 'kan790-pg3-retry-auth'
  const now = '2026-10-14T21:30:00.000Z'
  const scope = {
    userId: prefix+'-user', teamId: prefix+'-team',
    groupId: prefix+'-group', groupTrainingPlanId: prefix+'-plan',
    planningCohortId: null,
  }
  try {
    assert.equal((await sql<{db:string}[]>`SELECT current_database() AS db`)[0]?.db,
      'kan789_acceptance')
    await sql`INSERT INTO users
      (id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${scope.userId},${scope.userId},${prefix+'@example.invalid'},
        'PG3','Retry',${now},${now})`
    await sql`INSERT INTO teams (id,name,created_at,updated_at)
      VALUES (${scope.teamId},'PG3 disposable',${now},${now})`
    await sql`INSERT INTO athlete_groups
      (id,team_id,category_code,level_code,created_at,updated_at)
      VALUES (${scope.groupId},${scope.teamId},'trail','beginner',${now},${now})`
    await sql`INSERT INTO group_training_plans
      (id,group_id,title,created_at,updated_at)
      VALUES (${scope.groupTrainingPlanId},${scope.groupId},'PG3 Plan',${now},${now})`
    await sql`INSERT INTO session_generation_review_snapshots
      (id,user_id,team_id,group_training_plan_id,group_id,
       schema_version,generator_version,proposal,generation_explanations,
       source_manifest,created_at,expires_at,status)
      VALUES (${prefix+'-snapshot'},${scope.userId},${scope.teamId},
       ${scope.groupTrainingPlanId},${scope.groupId},'1','1',
       ${JSON.stringify({events:[]})}::jsonb,${JSON.stringify({})}::jsonb,
       ${JSON.stringify({manifestVersion:1})}::jsonb,
       ${now},'2026-10-15T21:30:00.000Z','active')`

    let authorizationCalls = 0
    const transactionIds: number[] = []
    let writes = 0
    const operations = createAuthorizedReviewSnapshotPostgresConfirmationOperations({
      client: sql,
      authorize: async tx => {
        authorizationCalls++
        const rows = await tx<{pid:number;isolation:string}[]>`
          SELECT pg_backend_pid() AS pid,
            current_setting('transaction_isolation') AS isolation`
        transactionIds.push(rows[0].pid)
        assert.equal(rows[0].isolation, 'serializable')
        if (authorizationCalls === 1) {
          // A real PostgreSQL transaction failure, not a synthetic JS error.
          await tx`DO $$ BEGIN RAISE EXCEPTION 'retry authority'
            USING ERRCODE = '40001'; END $$`
        }
        return {kind:'denied' as const}
      },
      now: () => now,
      persist: async () => {
        writes++
        throw new Error('writer cannot run after revoked authorization')
      },
    })
    assert.deepEqual(await operations.confirm({
      groupTrainingPlanId: scope.groupTrainingPlanId,
      snapshotId: prefix+'-snapshot',
    }),{kind:'denied'})
    assert.equal(authorizationCalls,2,'retry must reauthorize with fresh scope')
    assert.equal(transactionIds.length,2)
    assert.equal(writes,0)
    const state = await sql<{status:string;consumed_at:string|null;result_reference:string|null}[]>`
      SELECT status,consumed_at,result_reference
      FROM session_generation_review_snapshots WHERE id = ${prefix+'-snapshot'}`
    assert.deepEqual(state[0],{
      status:'active',consumed_at:null,result_reference:null,
    })
  } finally {
    try {
      await sql`DELETE FROM session_generation_review_snapshots WHERE id = ${prefix+'-snapshot'}`
      await sql`DELETE FROM group_training_plans WHERE id = ${scope.groupTrainingPlanId}`
      await sql`DELETE FROM athlete_groups WHERE id = ${scope.groupId}`
      await sql`DELETE FROM teams WHERE id = ${scope.teamId}`
      await sql`DELETE FROM users WHERE id = ${scope.userId}`
    } finally {
      await sql.end()
    }
  }
})
