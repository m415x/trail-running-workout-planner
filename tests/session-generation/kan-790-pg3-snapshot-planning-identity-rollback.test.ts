import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { createAuthorizedReviewSnapshotPostgresConfirmationOperations } from '@/lib/session-generation/authorized-review-snapshot-postgres-confirmation'

test('KAN-790 PG-3 mismatched snapshot planning identity rolls back CAS before writer', async () => {
  const url = process.env.KAN789_PG_URL
  assert.ok(url, 'Real disposable PostgreSQL mandatory; no SKIP')
  const target = new URL(url)
  assert.equal(target.hostname, '127.0.0.1')
  assert.equal(target.port, '55439')
  assert.equal(target.pathname, '/kan791_regression_disposable')
  const sql = postgres(url, { max: 1, prepare: false })
  const id = 'kan790-pg3-identity'
  const now = '2026-10-14T21:30:00.000Z'
  const scope = {
    userId:id+'-user',teamId:id+'-team',groupId:id+'-group',
    groupTrainingPlanId:id+'-plan',planningCohortId:null,
  }
  try {
    assert.equal((await sql<{db:string}[]>`SELECT current_database() AS db`)[0]?.db,
      'kan791_regression_disposable')
    await sql`INSERT INTO users
      (id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${scope.userId},${scope.userId},${id+'@example.invalid'},
        'PG3','Identity',${now},${now})`
    await sql`INSERT INTO teams (id,name,created_at,updated_at)
      VALUES (${scope.teamId},'PG3 identity',${now},${now})`
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
      VALUES (${id+'-snapshot'},${scope.userId},${scope.teamId},
       ${scope.groupTrainingPlanId},${scope.groupId},'1','1',
       ${JSON.stringify({events:[]})}::jsonb,${JSON.stringify({})}::jsonb,
       ${JSON.stringify({manifestVersion:1})}::jsonb,${now},
       '2026-10-15T21:30:00.000Z','active')`
    let authorizations=0
    let writes=0
    const ops=createAuthorizedReviewSnapshotPostgresConfirmationOperations({
      client:sql,
      authorize:async tx=>{
        authorizations++
        const isolation=await tx<{value:string}[]>`
          SELECT current_setting('transaction_isolation') AS value`
        assert.equal(isolation[0]?.value,'serializable')
        // This must NOT be accepted merely because the snapshot opaque ID,
        // user, Team and Plan happen to match.
        return {kind:'authorized' as const,
          scope:{...scope,groupId:id+'-other-group'}}
      },
      now:()=>now,
      persist:async()=>{writes++;throw new Error('writer must not execute')},
    })
    await assert.rejects(
      ops.confirm({groupTrainingPlanId:scope.groupTrainingPlanId,snapshotId:id+'-snapshot'}),
      /reconciliation_conflict: snapshot planning scope changed/,
    )
    assert.equal(authorizations,2)
    assert.equal(writes,0)
    const rows=await sql<{status:string;consumed_at:string|null;result_reference:string|null}[]>`
      SELECT status,consumed_at,result_reference
      FROM session_generation_review_snapshots WHERE id=${id+'-snapshot'}`
    assert.deepEqual(rows[0],{status:'active',consumed_at:null,result_reference:null})
  } finally {
    try {
      await sql`DELETE FROM session_generation_review_snapshots WHERE id=${id+'-snapshot'}`
      await sql`DELETE FROM group_training_plans WHERE id=${scope.groupTrainingPlanId}`
      await sql`DELETE FROM athlete_groups WHERE id=${scope.groupId}`
      await sql`DELETE FROM teams WHERE id=${scope.teamId}`
      await sql`DELETE FROM users WHERE id=${scope.userId}`
    } finally {
      await sql.end()
    }
  }
})
