import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { reconcileAndPersistGeneratedSessionsPostgres } from '@/lib/session-generation/review-snapshot-reconciliation-writer-postgres'

test('KAN-790 PG-4 rejects an unapproved affected Group before Session or audit mutation', async () => {
  const url = process.env.KAN789_PG_URL
  assert.ok(url, 'Disposable PostgreSQL required, no SKIP')
  const target = new URL(url)
  assert.equal(target.hostname,'127.0.0.1')
  assert.equal(target.port,'55439')
  assert.equal(target.pathname,'/kan791_regression_disposable')
  const sql=postgres(url,{max:1,prepare:false})
  const id='kan790-pg4-audience'
  const now='2026-10-14T21:30:00.000Z'
  const teamId=id+'-team',groupId=id+'-group',foreignGroupId=id+'-foreign'
  const planId=id+'-plan',userId=id+'-user'
  try {
    assert.equal((await sql<{db:string}[]>`SELECT current_database() AS db`)[0]?.db,
      'kan791_regression_disposable')
    await sql`INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES(${userId},${userId},${id+'@example.invalid'},'PG4','Test',${now},${now})`
    await sql`INSERT INTO teams(id,name,created_at,updated_at)
      VALUES(${teamId},'PG4',${now},${now})`
    for(const group of [groupId,foreignGroupId]) {
      await sql`INSERT INTO athlete_groups
        (id,team_id,category_code,level_code,created_at,updated_at)
        VALUES(${group},${teamId},'trail',${group === groupId ? 'beginner' : 'intermediate'},${now},${now})`
    }
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
            groupId:foreignGroupId,microcycleId:id+'-micro',
            distanceKm:10,durationMin:null,elevationGain:null,
            intensityMethod:'hr_zone' as const,zone:'Z2' as const,
            referencePercentage:null,notes:null,
          },
        }],
        warnings:[],
      }],
      warnings:[],
    }
    await assert.rejects(
      sql.begin(async tx=>{
        await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
        await reconcileAndPersistGeneratedSessionsPostgres(tx,{
          planId,teamId,userId,proposal,
          generationExplanations:new Map(),
          authorizedGroupIds:new Set([groupId]),now,
        })
      }),
      /reconciliation_conflict: affected group authorization changed|La propuesta contiene una prescripción fuera de la planificación/,
    )
    const sessions=await sql<{n:number}[]>`
      SELECT count(*)::integer AS n FROM sessions WHERE shared_event_key=${id+'-shared'}`
    const audit=await sql<{n:number}[]>`
      SELECT count(*)::integer AS n FROM session_generation_modification_records
      WHERE group_training_plan_id=${planId}`
    assert.equal(sessions[0]?.n,0)
    assert.equal(audit[0]?.n,0)
  } finally {
    try{
      await sql`DELETE FROM session_generation_modification_records WHERE group_training_plan_id=${planId}`
      await sql`DELETE FROM group_session_prescriptions WHERE generation_key=${id+'-generation'}`
      await sql`DELETE FROM sessions WHERE shared_event_key=${id+'-shared'}`
      await sql`DELETE FROM microcycles WHERE id=${id+'-micro'}`
      await sql`DELETE FROM mesocycles WHERE id=${id+'-meso'}`
      await sql`DELETE FROM macrocycles WHERE id=${id+'-macro'}`
      await sql`DELETE FROM group_training_plans WHERE id=${planId}`
      await sql`DELETE FROM athlete_groups WHERE id IN (${groupId},${foreignGroupId})`
      await sql`DELETE FROM teams WHERE id=${teamId}`
      await sql`DELETE FROM users WHERE id=${userId}`
    } finally {await sql.end()}
  }
})
