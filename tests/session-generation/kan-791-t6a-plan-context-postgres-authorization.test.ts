import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { createAuthorizedReviewSnapshotPostgresTransactionOperations } from '@/lib/session-generation/authorized-review-snapshot-postgres-transaction'

test('KAN-791 T6-A PG Plan context is authorized and DENY leaks no identity or mutations', async () => {
  const url=process.env.KAN789_PG_URL
  assert.ok(url,'KAN789_PG_URL mandatory; SKIP forbidden')
  const target=new URL(url)
  assert.equal(target.hostname,'127.0.0.1')
  assert.equal(target.port,'55439')
  assert.equal(target.pathname,'/kan789_acceptance')
  const sql=postgres(url,{max:1,prepare:false})
  const id='kan791-t6a-context'
  const now='2026-10-15T12:00:00.000Z'
  const teamId=id+'-team',groupId=id+'-group',planId=id+'-plan',userId=id+'-user'
  try {
    assert.equal((await sql<{db:string}[]>`SELECT current_database() AS db`)[0]?.db,'kan789_acceptance')
    await sql`INSERT INTO teams(id,name,created_at,updated_at)
      VALUES (${teamId},'T6-A PG Team',${now},${now})`
    await sql`INSERT INTO athlete_groups(id,team_id,category_code,level_code,created_at,updated_at)
      VALUES (${groupId},${teamId},'trail','beginner',${now},${now})`
    await sql`INSERT INTO group_training_plans(id,group_id,title,created_at,updated_at)
      VALUES (${planId},${groupId},'T6-A Secret PG Plan',${now},${now})`
    await sql`INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${userId},${userId},${id+'@example.invalid'},'T6','Coach',${now},${now})`
    await sql`INSERT INTO team_memberships
      (id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at)
      VALUES (${id+'-membership'},${userId},${teamId},'coach','2026-01-01T00:00:00.000Z',true,${now},${now})`
    const actor=createAuthorizedReviewSnapshotPostgresTransactionOperations({
      client:sql,authenticatedUserId:async()=>userId,
      selectedTeamId:async()=>teamId,now:()=>now,
    })
    const none=createAuthorizedReviewSnapshotPostgresTransactionOperations({
      client:sql,authenticatedUserId:async()=>null,
      selectedTeamId:async()=>teamId,now:()=>now,
    })
    const foreign=createAuthorizedReviewSnapshotPostgresTransactionOperations({
      client:sql,authenticatedUserId:async()=>userId,
      selectedTeamId:async()=>id+'-foreign-team',now:()=>now,
    })
    const before=await sql<{count:number}[]>`SELECT count(*)::integer AS count
      FROM session_generation_review_snapshots WHERE group_training_plan_id=${planId}`
    assert.deepEqual(await actor.getPlanContext({groupTrainingPlanId:planId}),{
      kind:'available',plan:{
        id:planId,title:'T6-A Secret PG Plan',groupId,
        groupCategory:'trail',groupLevel:'beginner',planningCohortId:null,
      },
    })
    assert.deepEqual(await none.getPlanContext({groupTrainingPlanId:planId}),{kind:'denied'})
    assert.deepEqual(await foreign.getPlanContext({groupTrainingPlanId:planId}),{kind:'denied'})
    assert.deepEqual(await actor.getPlanContext({groupTrainingPlanId:id+'-other-plan'}),{kind:'denied'})
    await sql`UPDATE team_memberships SET is_active=false WHERE id=${id+'-membership'}`
    assert.deepEqual(await actor.getPlanContext({groupTrainingPlanId:planId}),{kind:'denied'})
    const after=await sql<{count:number}[]>`SELECT count(*)::integer AS count
      FROM session_generation_review_snapshots WHERE group_training_plan_id=${planId}`
    assert.deepEqual(after,before,'read-only Plan context cannot allocate snapshots')
  } finally {
    try {
      await sql`DELETE FROM team_memberships WHERE id=${id+'-membership'}`
      await sql`DELETE FROM group_training_plans WHERE id=${planId}`
      await sql`DELETE FROM athlete_groups WHERE id=${groupId}`
      await sql`DELETE FROM teams WHERE id=${teamId}`
      await sql`DELETE FROM users WHERE id=${userId}`
    } finally {await sql.end()}
  }
})
