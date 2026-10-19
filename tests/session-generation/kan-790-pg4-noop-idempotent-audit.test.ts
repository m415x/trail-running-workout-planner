import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { reconcileAndPersistGeneratedSessionsPostgres } from '@/lib/session-generation/review-snapshot-reconciliation-writer-postgres'

test('KAN-790 PG-4 does not audit or mutate generated records when proposal is unchanged', async () => {
  const url = process.env.KAN789_PG_URL
  assert.ok(url, 'Disposable PostgreSQL required, no SKIP')
  const target = new URL(url)
  assert.equal(target.hostname,'127.0.0.1')
  assert.equal(target.port,'55439')
  assert.equal(target.pathname,'/kan791_regression_disposable')
  const sql=postgres(url,{max:1,prepare:false})
  const id='kan790-pg4-noop'
  const now='2026-10-14T21:30:00.000Z'
  const teamId=id+'-team',groupId=id+'-group'
  const planId=id+'-plan',userId=id+'-user'
  try {
    assert.equal((await sql<{db:string}[]>`SELECT current_database() AS db`)[0]?.db,
      'kan791_regression_disposable')
    await sql`INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES(${userId},${userId},${id+'@example.invalid'},'PG4','Test',${now},${now})`
    await sql`INSERT INTO teams(id,name,created_at,updated_at)
      VALUES(${teamId},'PG4',${now},${now})`
    await sql`INSERT INTO athlete_groups
      (id,team_id,category_code,level_code,created_at,updated_at)
      VALUES(${groupId},${teamId},'trail','beginner',${now},${now})`
    await sql`INSERT INTO group_training_plans(id,group_id,title,created_at,updated_at)
      VALUES(${planId},${groupId},'PG4',${now},${now})`
    await sql`INSERT INTO macrocycles
      (id,title,group_training_plan_id,start_date,end_date,created_at,updated_at)
      VALUES(${id+'-macro'},'Macro',${planId},'2027-01-01','2027-03-31',${now},${now})`
    await sql`INSERT INTO mesocycles
      (id,macrocycle_id,title,number,period,objective,created_at,updated_at)
      VALUES(${id+'-meso'},${id+'-macro'},'Meso',1,'general_preparatory','base',${now},${now})`
    await sql`INSERT INTO microcycles
      (id,mesocycle_id,week_number,type,start_date,end_date,created_at,updated_at)
      VALUES(${id+'-micro'},${id+'-meso'},1,'base','2027-01-04','2027-01-10',${now},${now})`
    const proposal={
      events:[{
        sharedEventKey:id+'-shared',
        session:{
          date:'2027-01-05',title:'PG4 candidate',type:'Trail' as const,
          sourceTemplateId:null,locationKey:null,trackPath:null,
          structure:null,notes:null,
        },
        prescriptions:[{
          generationKey:id+'-generation',slotKey:'tuesday-base',
          role:'base' as const,warnings:[],
          prescription:{
            groupId,microcycleId:id+'-micro',
            distanceKm:10,durationMin:null,elevationGain:null,
            intensityMethod:'hr_zone' as const,zone:'Z2' as const,
            referencePercentage:null,notes:null,
          },
        }],
        warnings:[],
      }],
      warnings:[],
    }
    // Existing generated records have the same stable keys as the new proposal.
    // Reconciliation must preserve them without UPDATE or audit on an identical proposal.
    await sql`INSERT INTO sessions
      (id,team_id,date,title,type,generation_ownership,shared_event_key,
       created_at,updated_at)
      VALUES(${id+'-existing-session'},${teamId},'2027-01-05','PG4 candidate',
        'Trail','generated',${id+'-shared'},${now},${now})`
    await sql`INSERT INTO group_session_prescriptions
      (id,session_id,group_id,microcycle_id,distance_km,
       intensity_method,zone,generation_ownership,generation_key,created_at,updated_at)
      VALUES(${id+'-existing-prescription'},${id+'-existing-session'},
        ${groupId},${id+'-micro'},10,'hr_zone','Z2','generated',
        ${id+'-generation'},${now},${now})`
    await sql.begin(async tx=>{
      await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      const preserved=await reconcileAndPersistGeneratedSessionsPostgres(tx,{
        planId,teamId,userId,proposal,
        generationExplanations:new Map(),
        authorizedGroupIds:new Set([groupId]),now,
      })
      assert.equal(preserved,0, 'generated rows must be reconciled rather than preserved')
      const sessions=await tx<{id:string;ownership:string}[]>`
        SELECT id,generation_ownership AS ownership FROM sessions
        WHERE shared_event_key=${id+'-shared'}`
      assert.equal(sessions.length,1)
      assert.equal(sessions[0].ownership,'generated')
      assert.equal(sessions[0].id,id+'-existing-session')
      const prescriptions=await tx<{id:string;session_id:string;group_id:string}[]>`
        SELECT id,session_id,group_id FROM group_session_prescriptions
        WHERE generation_key=${id+'-generation'}`
      assert.equal(prescriptions.length,1)
      assert.equal(prescriptions[0].session_id,sessions[0].id)
      assert.equal(prescriptions[0].id,id+'-existing-prescription')
      assert.equal(prescriptions[0].group_id,groupId)
      const audit=await tx<{action:string}[]>`
        SELECT action FROM session_generation_modification_records
        WHERE group_training_plan_id=${planId} ORDER BY action`
      assert.deepEqual(audit.map(x=>x.action),[], 'unchanged data must not generate audit records')
      const updatedSession=await tx<{title:string;ownership:string}[]>`
        SELECT title,generation_ownership AS ownership FROM sessions
        WHERE id=${id+'-existing-session'}`
      assert.deepEqual(updatedSession[0],{title:'PG4 candidate',ownership:'generated'})
      const updatedPrescription=await tx<{distance:number;ownership:string}[]>`
        SELECT distance_km AS distance,generation_ownership AS ownership
        FROM group_session_prescriptions WHERE id=${id+'-existing-prescription'}`
      assert.deepEqual(updatedPrescription[0],{distance:10,ownership:'generated'})
      throw new Error('pg4-create-rollback')
    }).then(
      ()=>assert.fail('expected test rollback'),
      error=>assert.match(String(error),/pg4-create-rollback/),
    )
    const sessionsAfter=await sql<{n:number}[]>`
      SELECT count(*)::integer AS n FROM sessions WHERE shared_event_key=${id+'-shared'}`
    const prescriptionsAfter=await sql<{n:number}[]>`
      SELECT count(*)::integer AS n FROM group_session_prescriptions
      WHERE generation_key=${id+'-generation'}`
    const auditAfter=await sql<{n:number}[]>`
      SELECT count(*)::integer AS n FROM session_generation_modification_records
      WHERE group_training_plan_id=${planId}`
    assert.deepEqual([sessionsAfter[0]?.n,prescriptionsAfter[0]?.n,auditAfter[0]?.n],[1,1,0])
    assert.equal((await sql<{title:string}[]>`SELECT title FROM sessions WHERE id=${id+'-existing-session'}`)[0]?.title,'PG4 candidate')
    assert.equal((await sql<{distance:number}[]>`SELECT distance_km AS distance FROM group_session_prescriptions WHERE id=${id+'-existing-prescription'}`)[0]?.distance,10)
  } finally {
    try{
      await sql`DELETE FROM session_generation_modification_records WHERE group_training_plan_id=${planId}`
      await sql`DELETE FROM group_session_prescriptions WHERE generation_key=${id+'-generation'}`
      await sql`DELETE FROM group_session_prescriptions WHERE id=${id+'-existing-prescription'}`
      await sql`DELETE FROM sessions WHERE shared_event_key=${id+'-shared'}`
      await sql`DELETE FROM sessions WHERE id=${id+'-existing-session'}`
      await sql`DELETE FROM microcycles WHERE id=${id+'-micro'}`
      await sql`DELETE FROM mesocycles WHERE id=${id+'-meso'}`
      await sql`DELETE FROM macrocycles WHERE id=${id+'-macro'}`
      await sql`DELETE FROM group_training_plans WHERE id=${planId}`
      await sql`DELETE FROM athlete_groups WHERE id=${groupId}`
      await sql`DELETE FROM teams WHERE id=${teamId}`
      await sql`DELETE FROM users WHERE id=${userId}`
    } finally {await sql.end()}
  }
})
