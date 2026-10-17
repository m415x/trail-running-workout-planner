import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'
import { SESSION_GENERATION_SNAPSHOT_LIMITS } from '@/lib/session-generation/review-snapshot-limits'

import { readReviewSnapshotEffectiveManifestPostgres } from '@/lib/session-generation/review-snapshot-effective-manifest-postgres'
import { createAuthorizedReviewSnapshotPostgresSessionOperations } from '@/lib/session-generation/authorized-review-snapshot-postgres-session'

test('KAN-790 T5.5 CREATE enforces active snapshot quota and preserves existing rows', async () => {
  const url = process.env.KAN789_PG_URL
  assert.ok(url, 'KAN789_PG_URL required; SKIP is not acceptable')
  const target = new URL(url)
  assert.equal(target.hostname, '127.0.0.1')
  assert.equal(target.port, '55439')
  assert.equal(target.pathname, '/kan791_regression_disposable')
  const sql = postgres(url, { max: 1, prepare: false })
  const id = 'kan790-t55-create-quota'
  const now = '2026-10-14T21:30:00.000Z'
  const scope = { groupTrainingPlanId: id+'-plan', teamId: id+'-team', groupId: id+'-group' }
  try {
    assert.equal((await sql<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db,
      'kan791_regression_disposable')
    await sql`INSERT INTO teams (id,name,created_at,updated_at)
      VALUES (${scope.teamId},'PG2 effective',${now},${now})`
    await sql`INSERT INTO athlete_groups (id,team_id,category_code,level_code,created_at,updated_at)
      VALUES (${scope.groupId},${scope.teamId},'trail','beginner',${now},${now})`
    await sql`INSERT INTO group_training_plans (id,group_id,title,created_at,updated_at)
      VALUES (${scope.groupTrainingPlanId},${scope.groupId},'PG2 Plan',${now},${now})`
    await sql`INSERT INTO macrocycles
      (id,title,group_training_plan_id,start_date,end_date,created_at,updated_at)
      VALUES (${id+'-macro'},'Macro',${scope.groupTrainingPlanId},
        '2027-01-01','2027-03-31',${now},${now})`
    await sql`INSERT INTO mesocycles
      (id,macrocycle_id,title,number,period,objective,created_at,updated_at)
      VALUES (${id+'-meso'},${id+'-macro'},'Meso',1,'general_preparatory','base',${now},${now})`
    await sql`INSERT INTO microcycles
      (id,mesocycle_id,week_number,type,start_date,end_date,target_volume_km,created_at,updated_at)
      VALUES (${id+'-micro'},${id+'-meso'},1,'base','2027-01-04','2027-01-10',
        42,${now},${now})`
    await sql`INSERT INTO load_strategies
      (id,group_training_plan_id,goal_type,initial_weekly_volume_km,
       maximum_weekly_volume_km,sessions_per_week,maximum_weekly_increase_percentage,
       deload_percentage,field_sources,created_at,updated_at)
      VALUES (${id+'-load'},${scope.groupTrainingPlanId},'finish',30,60,4,10,30,
        (${JSON.stringify({})}::text)::jsonb,${now},${now})`
    await sql`INSERT INTO intensity_strategies
      (id,group_training_plan_id,goal_type,default_method,
       maximum_intense_sessions_per_week,minimum_recovery_days_between_intense_sessions,
       field_sources,created_at,updated_at)
      VALUES (${id+'-intensity'},${scope.groupTrainingPlanId},'finish','hr_zone',2,2,
        ${JSON.stringify({})}::jsonb,${now},${now})`
    await sql`INSERT INTO microcycle_intensity_targets
      (id,microcycle_id,emphasis,intense_sessions_target,predominant_zone,
       minimum_recovery_days_between_intense_sessions,field_sources,created_at,updated_at)
      VALUES (${id+'-target'},${id+'-micro'},'aerobic',1,'Z2',2,
        ${JSON.stringify({})}::jsonb,${now},${now})`
    await sql`INSERT INTO competition_entries
      (id,group_training_plan_id,name,date,distance_km,priority,created_at,updated_at)
      VALUES (${id+'-race'},${scope.groupTrainingPlanId},'Race','2027-02-01',21,
        'A',${now},${now})`

    await sql`INSERT INTO users
      (id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${id+'-user'},${id+'-user'},${id+'@example.invalid'},
        'PG3','Stale',${now},${now})`
    const baseline = await sql.begin(async tx => {
      await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      return readReviewSnapshotEffectiveManifestPostgres(tx,scope)
    })
    assert.equal(baseline?.generationInputCount,1)
    // Trusted H2 identity and selected Team are supplied by the server;
    // current Coach membership and planning.manage are read using PG tx.
    await sql`INSERT INTO team_memberships
      (id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at)
      VALUES (${id+'-membership'},${id+'-user'},${scope.teamId},'coach',
        '2026-01-01T00:00:00.000Z',true,${now},${now})`
    await sql`INSERT INTO external_identity_links
      (id,user_id,provider,subject,created_at,updated_at)
      VALUES (${id+'-link'},${id+'-user'},'supabase',${id+'-external'},
        ${now},${now})`
    const operations=createAuthorizedReviewSnapshotPostgresSessionOperations({
      client:sql,
      auth:{
        getClaims:async()=>({data:{claims:{sub:id+'-external'}},error:null}),
        getUser:async()=>({data:{user:{id:id+'-external'}},error:null}),
      },
      readPersistedTeamId:async()=>scope.teamId,
      now:()=>now,
    })
    // Fill the approved active quota with real server-authorized CREATEs.
    // The following attempt must fail atomically, without expiring or replacing
    // any existing active review.
    const createdIds:string[]=[]
    for(let i=0;i<SESSION_GENERATION_SNAPSHOT_LIMITS.maxActivePerOwnerPlan;i++){
      const created=await operations.create({groupTrainingPlanId:scope.groupTrainingPlanId})
      assert.equal(created.kind,'created')
      if(created.kind!=='created')throw Error('Unexpected CREATE denial')
      createdIds.push(created.snapshotId)
    }
    await assert.rejects(
      operations.create({groupTrainingPlanId:scope.groupTrainingPlanId}),
      /quota|limit/i,
      'CREATE must enforce approved active quota without mutation',
    )
    const rows=await sql<{id:string;status:string}[]>`
      SELECT id,status FROM session_generation_review_snapshots
      WHERE group_training_plan_id=${scope.groupTrainingPlanId} ORDER BY id`
    assert.deepEqual(rows.map(row=>row.id).sort(),createdIds.sort())
    assert.ok(rows.every(row=>row.status==='active'))
  } finally {
    try {
      await sql`DELETE FROM session_generation_review_snapshots WHERE group_training_plan_id = ${scope.groupTrainingPlanId}`
      await sql`DELETE FROM session_generation_modification_records
        WHERE group_training_plan_id=${scope.groupTrainingPlanId}`
      await sql`DELETE FROM group_session_prescriptions
        WHERE generation_key=${id+'-generation'}`
      await sql`DELETE FROM sessions WHERE shared_event_key=${id+'-shared'}`
      await sql`DELETE FROM competition_entries WHERE id = ${id+'-race'}`
      await sql`DELETE FROM microcycle_intensity_targets WHERE id = ${id+'-target'}`
      await sql`DELETE FROM intensity_strategies WHERE id = ${id+'-intensity'}`
      await sql`DELETE FROM load_strategies WHERE id = ${id+'-load'}`
      await sql`DELETE FROM microcycles WHERE id = ${id+'-micro'}`
      await sql`DELETE FROM mesocycles WHERE id = ${id+'-meso'}`
      await sql`DELETE FROM macrocycles WHERE id = ${id+'-macro'}`
      await sql`DELETE FROM group_training_plans WHERE id = ${scope.groupTrainingPlanId}`
      await sql`DELETE FROM athlete_groups WHERE id = ${scope.groupId}`
      await sql`DELETE FROM external_identity_links WHERE id=${id+'-link'}`
      await sql`DELETE FROM team_memberships WHERE id = ${id+'-membership'}`
      await sql`DELETE FROM teams WHERE id = ${scope.teamId}`
      await sql`DELETE FROM users WHERE id = ${id+'-user'}`
    } finally {
      await sql.end()
    }
  }
})
