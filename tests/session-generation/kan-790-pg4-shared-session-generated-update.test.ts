import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { reconcileAndPersistGeneratedSessionsPostgres } from '@/lib/session-generation/review-snapshot-reconciliation-writer-postgres'

test('KAN-790 PG-4 updates generated shared Session in place without modifying other Plan prescription', async () => {
  const url = process.env.KAN789_PG_URL
  assert.ok(url, 'Disposable PG required; NO SKIP')
  const target = new URL(url)
  assert.equal(target.hostname, '127.0.0.1')
  assert.equal(target.port, '55439')
  assert.equal(target.pathname, '/kan791_regression_disposable')
  const sql = postgres(url, { max: 1, prepare: false })
  const id = 'kan790-pg4-shared-update'
  const now = '2026-10-14T21:30:00.000Z'
  const userId = id+'-user', teamId = id+'-team'
  const groupId = id+'-group', planId = id+'-plan'
  const otherGroupId = id+'-other-group', otherPlanId = id+'-other-plan'
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
    // Separate Plan and microcycle ensure session_id + microcycle_id remain unique.
    await sql`INSERT INTO athlete_groups
      (id,team_id,category_code,level_code,created_at,updated_at)
      VALUES(${otherGroupId},${teamId},'trail','intermediate',${now},${now})`
    await sql`INSERT INTO group_training_plans(id,group_id,title,created_at,updated_at)
      VALUES(${otherPlanId},${otherGroupId},'Other Plan',${now},${now})`
    await sql`INSERT INTO macrocycles
      (id,title,group_training_plan_id,start_date,end_date,created_at,updated_at)
      VALUES(${id+'-other-macro'},'Other Macro',${otherPlanId},
        '2027-01-01','2027-03-31',${now},${now})`
    await sql`INSERT INTO mesocycles
      (id,macrocycle_id,title,number,period,objective,created_at,updated_at)
      VALUES(${id+'-other-meso'},${id+'-other-macro'},'Other Meso',1,
        'general_preparatory','base',${now},${now})`
    await sql`INSERT INTO microcycles
      (id,mesocycle_id,week_number,type,start_date,end_date,created_at,updated_at)
      VALUES(${id+'-other-micro'},${id+'-other-meso'},1,'base',
        '2027-01-04','2027-01-10',${now},${now})`
    // Generated Session is shared with another Plan; proposed stable keys match Plan A.
    await sql`INSERT INTO sessions
      (id,team_id,date,title,type,generation_ownership,shared_event_key,created_at,updated_at)
      VALUES(${id+'-old-session'},${teamId},'2027-01-06','Obsolete generated',
        'Trail','generated',${id+'-old-key'},${now},${now})`
    await sql`INSERT INTO group_session_prescriptions
      (id,session_id,group_id,microcycle_id,distance_km,
       generation_ownership,generation_key,created_at,updated_at)
      VALUES(${id+'-old-prescription'},${id+'-old-session'},${groupId},
       ${id+'-micro'},20,'generated',${id+'-old-generation'},${now},${now})`
    await sql`INSERT INTO group_session_prescriptions
      (id,session_id,group_id,microcycle_id,distance_km,
       generation_ownership,generation_key,created_at,updated_at)
      VALUES(${id+'-other-prescription'},${id+'-old-session'},${otherGroupId},
        ${id+'-other-micro'},35,'generated',
        ${id+'-other-generation'},${now},${now})`
    const proposal = {events:[{
      sharedEventKey:id+'-old-key',
      session:{date:'2027-01-07',title:'New generated',type:'Trail' as const,
        sourceTemplateId:null,locationKey:null,trackPath:null,structure:null,notes:null},
      prescriptions:[{
        generationKey:id+'-old-generation',slotKey:'thursday-base',
        role:'base' as const,warnings:[],
        prescription:{groupId,microcycleId:id+'-micro',distanceKm:12,
          durationMin:null,elevationGain:null,intensityMethod:'hr_zone' as const,
          zone:'Z2' as const,referencePercentage:null,notes:null},
      }],warnings:[],
    }],warnings:[]}
    await sql.begin(async tx => {
      await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      assert.equal(await reconcileAndPersistGeneratedSessionsPostgres(tx,{
        planId,teamId,userId,proposal,generationExplanations:new Map(),
        authorizedGroupIds:new Set([groupId,otherGroupId]),now,
      }),0)
      const oldPrescriptions = await tx<{is_deleted:boolean}[]>`
        SELECT is_deleted FROM group_session_prescriptions WHERE id=${id+'-old-prescription'}`
      assert.equal(oldPrescriptions[0]?.is_deleted,false)
      const updatedPlanPrescription=await tx<{distance_km:number}[]>`
        SELECT distance_km FROM group_session_prescriptions WHERE id=${id+'-old-prescription'}`
      assert.equal(updatedPlanPrescription[0]?.distance_km,12)
      const oldEvents = await tx<{is_deleted:boolean;title:string}[]>`
        SELECT is_deleted,title FROM sessions WHERE id=${id+'-old-session'}`
      assert.deepEqual(oldEvents[0],{is_deleted:false,title:'New generated'})
      const other=await tx<{is_deleted:boolean;distance_km:number}[]>`
        SELECT is_deleted,distance_km FROM group_session_prescriptions
        WHERE id=${id+'-other-prescription'}`
      assert.deepEqual(other[0],{is_deleted:false,distance_km:35})
      const audit = await tx<{action:string;prescription_id:string|null;previous_value:string|null}[]>`
        SELECT action,prescription_id,previous_value
        FROM session_generation_modification_records
        WHERE group_training_plan_id=${planId}`
      assert.equal(audit.filter(r=>r.action==='generated_removed').length,0)
      assert.equal(audit.filter(r=>r.action==='generated_updated').length,2)
      assert.ok(audit.filter(r=>r.action==='generated_updated').every(r=>r.previous_value !== null))
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
    assert.equal((await sql<{title:string}[]>`
      SELECT title FROM sessions WHERE id=${id+'-old-session'}`)[0]?.title,'Obsolete generated')
    assert.equal((await sql<{distance_km:number}[]>`
      SELECT distance_km FROM group_session_prescriptions
      WHERE id=${id+'-old-prescription'}`)[0]?.distance_km,20)
    assert.equal((await sql<{n:number}[]>`
      SELECT count(*)::integer AS n FROM group_session_prescriptions
      WHERE id=${id+'-other-prescription'} AND is_deleted=false`)[0]?.n,1)
    assert.equal((await sql<{n:number}[]>`
      SELECT count(*)::integer AS n FROM session_generation_modification_records
      WHERE group_training_plan_id=${planId}`)[0]?.n,0)
    assert.equal((await sql<{n:number}[]>`
      SELECT count(*)::integer AS n FROM sessions WHERE shared_event_key=${id+'-new-key'}`)[0]?.n,0)
  } finally {
    try {
      await sql`DELETE FROM session_generation_modification_records WHERE group_training_plan_id=${planId}`
      await sql`DELETE FROM group_session_prescriptions
        WHERE generation_key IN (${id+'-old-generation'},${id+'-new-generation'},${id+'-other-generation'})`
      await sql`DELETE FROM sessions WHERE shared_event_key IN (${id+'-old-key'},${id+'-new-key'})`
      await sql`DELETE FROM microcycles WHERE id=${id+'-micro'}`
      await sql`DELETE FROM microcycles WHERE id=${id+'-other-micro'}`
      await sql`DELETE FROM mesocycles WHERE id=${id+'-meso'}`
      await sql`DELETE FROM mesocycles WHERE id=${id+'-other-meso'}`
      await sql`DELETE FROM macrocycles WHERE id=${id+'-macro'}`
      await sql`DELETE FROM macrocycles WHERE id=${id+'-other-macro'}`
      await sql`DELETE FROM group_training_plans WHERE id=${planId}`
      await sql`DELETE FROM group_training_plans WHERE id=${otherPlanId}`
      await sql`DELETE FROM athlete_groups WHERE id=${groupId}`
      await sql`DELETE FROM athlete_groups WHERE id=${otherGroupId}`
      await sql`DELETE FROM teams WHERE id=${teamId}`
      await sql`DELETE FROM users WHERE id=${userId}`
    } finally { await sql.end() }
  }
})
