import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { reconcileAndPersistGeneratedSessionsPostgres } from '@/lib/session-generation/review-snapshot-reconciliation-writer-postgres'

test('KAN-790 PG-4 accepts an empty proposal and atomically retires obsolete generated rows', async () => {
  const url = process.env.KAN789_PG_URL
  assert.ok(url, 'Disposable PG required; NO SKIP')
  const target = new URL(url)
  assert.equal(target.hostname, '127.0.0.1')
  assert.equal(target.port, '55439')
  assert.equal(target.pathname, '/kan791_regression_disposable')
  const sql = postgres(url, { max: 1, prepare: false })
  const id = 'kan790-pg4-empty'
  const now = '2026-10-14T21:30:00.000Z'
  const userId = id+'-user', teamId = id+'-team'
  const groupId = id+'-group', planId = id+'-plan'
  try {
    assert.equal((await sql<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db, 'kan791_regression_disposable')
    await sql`INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES(${userId},${userId},${id+'@example.invalid'},'PG4','Obsolete',${now},${now})`
    await sql`INSERT INTO teams(id,name,created_at,updated_at)
      VALUES(${teamId},'PG4 obsolete',${now},${now})`
    await sql`INSERT INTO athlete_groups
      (id,team_id,category_code,level_code,created_at,updated_at)
      VALUES(${groupId},${teamId},'trail','beginner',${now},${now})`
    await sql`INSERT INTO group_training_plans(id,group_id,title,created_at,updated_at)
      VALUES(${planId},${groupId},'PG4 obsolete',${now},${now})`
    await sql`INSERT INTO macrocycles
      (id,title,group_training_plan_id,start_date,end_date,created_at,updated_at)
      VALUES(${id+'-macro'},'Macro',${planId},'2027-01-01','2027-03-31',${now},${now})`
    await sql`INSERT INTO mesocycles
      (id,macrocycle_id,title,number,period,objective,created_at,updated_at)
      VALUES(${id+'-meso'},${id+'-macro'},'Meso',1,'general_preparatory','base',${now},${now})`
    await sql`INSERT INTO microcycles
      (id,mesocycle_id,week_number,type,start_date,end_date,created_at,updated_at)
      VALUES(${id+'-micro'},${id+'-meso'},1,'base','2027-01-04','2027-01-10',${now},${now})`
    // An old generated event is no longer part of the proposed schedule.
    await sql`INSERT INTO sessions
      (id,team_id,date,title,type,generation_ownership,shared_event_key,created_at,updated_at)
      VALUES(${id+'-old-session'},${teamId},'2027-01-06','Obsolete generated',
        'Trail','generated',${id+'-old-key'},${now},${now})`
    await sql`INSERT INTO group_session_prescriptions
      (id,session_id,group_id,microcycle_id,distance_km,
       generation_ownership,generation_key,created_at,updated_at)
      VALUES(${id+'-old-prescription'},${id+'-old-session'},${groupId},
       ${id+'-micro'},20,'generated',${id+'-old-generation'},${now},${now})`
    const proposal = {events:[],warnings:[]}
    await sql.begin(async tx => {
      await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      assert.equal(await reconcileAndPersistGeneratedSessionsPostgres(tx,{
        planId,teamId,userId,proposal,generationExplanations:new Map(),
        authorizedGroupIds:new Set([groupId]),now,
      }),0)
      const oldPrescriptions = await tx<{is_deleted:boolean}[]>`
        SELECT is_deleted FROM group_session_prescriptions WHERE id=${id+'-old-prescription'}`
      assert.equal(oldPrescriptions[0]?.is_deleted,true)
      const oldEvents = await tx<{is_deleted:boolean}[]>`
        SELECT is_deleted FROM sessions WHERE id=${id+'-old-session'}`
      assert.equal(oldEvents[0]?.is_deleted,true)
      const audit = await tx<{action:string;prescription_id:string|null;previous_value:string|null}[]>`
        SELECT action,prescription_id,previous_value
        FROM session_generation_modification_records
        WHERE group_training_plan_id=${planId}`
      assert.equal(audit.filter(r=>r.action==='generated_removed').length,2)
      assert.ok(audit.filter(r=>r.action==='generated_removed').every(r=>r.previous_value !== null))
      assert.equal(audit.filter(r=>r.action==='generated_created').length,0)
      throw new Error('pg4-obsolete-rollback')
    }).then(
      ()=>assert.fail('expected rollback'),
      error=>assert.match(String(error),/pg4-obsolete-rollback/),
    )
    const rows = await sql<{p:boolean;s:boolean}[]>`
      SELECT gp.is_deleted AS p,s.is_deleted AS s
      FROM group_session_prescriptions gp JOIN sessions s ON s.id=gp.session_id
      WHERE gp.id=${id+'-old-prescription'}`
    assert.deepEqual(rows[0],{p:false,s:false})
    assert.equal((await sql<{n:number}[]>`
      SELECT count(*)::integer AS n FROM session_generation_modification_records
      WHERE group_training_plan_id=${planId}`)[0]?.n,0)
    assert.equal((await sql<{n:number}[]>`
      SELECT count(*)::integer AS n FROM sessions WHERE shared_event_key=${id+'-new-key'}`)[0]?.n,0)
  } finally {
    try {
      await sql`DELETE FROM session_generation_modification_records WHERE group_training_plan_id=${planId}`
      await sql`DELETE FROM group_session_prescriptions
        WHERE generation_key IN (${id+'-old-generation'},${id+'-new-generation'})`
      await sql`DELETE FROM sessions WHERE shared_event_key IN (${id+'-old-key'},${id+'-new-key'})`
      await sql`DELETE FROM microcycles WHERE id=${id+'-micro'}`
      await sql`DELETE FROM mesocycles WHERE id=${id+'-meso'}`
      await sql`DELETE FROM macrocycles WHERE id=${id+'-macro'}`
      await sql`DELETE FROM group_training_plans WHERE id=${planId}`
      await sql`DELETE FROM athlete_groups WHERE id=${groupId}`
      await sql`DELETE FROM teams WHERE id=${teamId}`
      await sql`DELETE FROM users WHERE id=${userId}`
    } finally { await sql.end() }
  }
})
