import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import postgres from 'postgres'
import { generateReviewSnapshotFromEffectivePostgres } from '@/lib/session-generation/review-snapshot-generate-postgres'
import { DEFAULT_WEEKLY_TRAINING_PATTERN } from '@/lib/session-generation/default-weekly-pattern'

config({path:'.env.local'})
const ID='kan791-annual-pg-239'
const NOW='2026-10-15T12:00:00.000Z'
const START='2027-01-04'
const scope={groupTrainingPlanId:ID+'-plan',teamId:ID+'-team',
  groupId:ID+'-group',planningCohortId:null}
const iso=(day:number)=>{
  const date=new Date(START+'T00:00:00.000Z')
  date.setUTCDate(date.getUTCDate()+day)
  return date.toISOString().slice(0,10)
}
type Sql=ReturnType<typeof postgres>
function connection():Sql {
  const url=process.env.KAN789_PG_URL
  assert.ok(url,'KAN789_PG_URL required; NO SKIP')
  const target=new URL(url)
  assert.equal(target.hostname,'127.0.0.1')
  assert.equal(target.port,'55439')
  assert.equal(target.pathname,'/kan789_acceptance')
  const next=process.env.SUPABASE_DATABASE_URL
  if(next) {
    const targetNext=new URL(next)
    assert.equal(targetNext.hostname,target.hostname)
    assert.equal(targetNext.port,target.port)
    assert.equal(targetNext.pathname,target.pathname)
  }
  return postgres(url,{max:1,prepare:false})
}
async function verify(sql:Sql) {
  const generated=await sql.begin(async tx=>{
    await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
    return generateReviewSnapshotFromEffectivePostgres(tx,scope)
  })
  assert.equal(generated.microcycleCount,53)
  assert.equal(generated.sourceManifest.generationInputCount,53)
  assert.equal(generated.sessionCount,239)
  assert.equal(generated.proposal.events.length,239)
  assert.equal(generated.proposal.events.flatMap(event=>event.prescriptions).length,239)
  assert.equal(Object.keys(generated.generationExplanations).length,239)
  const count=await sql<{n:number}[]>`SELECT count(*)::integer AS n FROM microcycles mi
    JOIN mesocycles me ON me.id=mi.mesocycle_id
    JOIN macrocycles ma ON ma.id=me.macrocycle_id
    WHERE ma.group_training_plan_id=${scope.groupTrainingPlanId}`
  assert.equal(count[0]?.n,53)
  const fingerprint=createHash('sha256').update(JSON.stringify({
    events:generated.proposal.events,
    explanations:generated.generationExplanations,
    manifest:generated.sourceManifest,
  })).digest('hex')
  return {planId:scope.groupTrainingPlanId,teamId:scope.teamId,groupId:scope.groupId,
    microcycles:53,events:239,prescriptions:239,explanations:239,
    fingerprint}
}
async function main() {
  const mode=process.argv[2]
  assert.ok(mode==='setup'||mode==='verify'||mode==='cleanup',
    'Usage: pn exec tsx scripts/kan-791-annual-http-fixture.ts setup|verify|cleanup')
  const sql=connection()
  try {
    assert.equal((await sql<{db:string}[]>`SELECT current_database() AS db`)[0]?.db,
      'kan789_acceptance')
    const exists=await sql`SELECT id FROM group_training_plans WHERE id=${scope.groupTrainingPlanId}`
    if(mode==='setup' && exists.length===0) {
      // One atomic setup transaction. No half-seeded fixture on failure.
      await sql.begin(async tx=>{
        const mesoIds=['a','b','c','d','e']
      await tx`INSERT INTO teams (id,name,created_at,updated_at)
        VALUES (${scope.teamId},'Annual 239 disposable fixture',${NOW},${NOW})`
      await tx`INSERT INTO athlete_groups (id,team_id,category_code,level_code,created_at,updated_at)
        VALUES (${scope.groupId},${scope.teamId},'trail','beginner',${NOW},${NOW})`
      await tx`INSERT INTO group_training_plans (id,group_id,title,created_at,updated_at)
        VALUES (${scope.groupTrainingPlanId},${scope.groupId},'Annual 239',${NOW},${NOW})`
      await tx`INSERT INTO macrocycles
        (id,title,group_training_plan_id,start_date,end_date,created_at,updated_at)
        VALUES (${ID+'-macro'},'Annual',${scope.groupTrainingPlanId},${START},${iso(370)},${NOW},${NOW})`
      for(let j=0;j<mesoIds.length;j++) {
        await tx`INSERT INTO mesocycles
          (id,macrocycle_id,title,number,period,objective,created_at,updated_at)
          VALUES (${ID+'-meso-'+mesoIds[j]},${ID+'-macro'},${'Phase '+(j+1)},
            ${j+1},${j<3?'general_preparatory':'specific_preparatory'},'base',${NOW},${NOW})`
      }
      for(let i=0;i<53;i++) {
        const microcycle=ID+'-micro-'+String(i+1).padStart(2,'0')
        const volume=i<27?51:42
        await tx`INSERT INTO microcycles
          (id,mesocycle_id,week_number,type,start_date,end_date,target_volume_km,target_elevation_gain,created_at,updated_at)
          VALUES (${microcycle},${ID+'-meso-'+mesoIds[Math.floor(i/11)]},
            ${i+1},'development',${iso(i*7)},${iso(i*7+6)},${volume},700,${NOW},${NOW})`
        await tx`INSERT INTO microcycle_intensity_targets
          (id,microcycle_id,emphasis,intense_sessions_target,predominant_zone,
           reference_percentage_target,minimum_recovery_days_between_intense_sessions,field_sources,created_at,updated_at)
          VALUES (${microcycle+'-target'},${microcycle},'vo2max',1,'Z2',
            95,2,${JSON.stringify({})}::jsonb,${NOW},${NOW})`
      }
      await tx`INSERT INTO load_strategies
        (id,group_training_plan_id,goal_type,initial_weekly_volume_km,
         maximum_weekly_volume_km,sessions_per_week,maximum_weekly_increase_percentage,
         deload_percentage,field_sources,created_at,updated_at)
        VALUES (${ID+'-load'},${scope.groupTrainingPlanId},'finish',42,60,5,10,30,
          ${JSON.stringify({})}::jsonb,${NOW},${NOW})`
      await tx`INSERT INTO intensity_strategies
        (id,group_training_plan_id,goal_type,default_method,
         maximum_intense_sessions_per_week,minimum_recovery_days_between_intense_sessions,
         field_sources,created_at,updated_at)
        VALUES (${ID+'-intensity'},${scope.groupTrainingPlanId},'finish','reference_percentage',
          2,2,${JSON.stringify({})}::jsonb,${NOW},${NOW})`
      await tx`INSERT INTO session_generation_preferences
        (id,group_training_plan_id,frequency_mode,weekly_pattern,created_at,updated_at)
        VALUES (${ID+'-prefs'},${scope.groupTrainingPlanId},'auto',
          ${JSON.stringify(DEFAULT_WEEKLY_TRAINING_PATTERN.slots.map(({weekday,role})=>({weekday,role})))},
          ${NOW},${NOW})`

      })
    }
    if(mode==='cleanup') {
      // Persist diagnostics BEFORE any destructive cleanup.
      const diagnostics={
        capturedAt:new Date().toISOString(),mode,
        planId:scope.groupTrainingPlanId,
        sessions:await sql`SELECT id,shared_event_key FROM sessions WHERE team_id=${scope.teamId}`,
        snapshots:await sql`SELECT id,status,created_at,expires_at FROM session_generation_review_snapshots WHERE group_training_plan_id=${scope.groupTrainingPlanId}`,
        prescriptions:await sql`SELECT gp.generation_key,gp.microcycle_id FROM group_session_prescriptions gp
          JOIN microcycles mi ON mi.id=gp.microcycle_id
          JOIN mesocycles me ON me.id=mi.mesocycle_id
          JOIN macrocycles ma ON ma.id=me.macrocycle_id
          WHERE ma.group_training_plan_id=${scope.groupTrainingPlanId}`,
      }
      const folder=resolve('.tmp','kan-791-http')
      await mkdir(folder,{recursive:true})
      const filename=resolve(folder,'cleanup-'+new Date().toISOString().replaceAll(':','-')+'.json')
      await writeFile(filename,JSON.stringify(diagnostics,null,2),'utf8')
      if(exists.length) {
        await sql.begin(async tx=>{
          await tx`DELETE FROM session_generation_review_snapshots WHERE group_training_plan_id=${scope.groupTrainingPlanId}`
          await tx`DELETE FROM session_generation_modification_records WHERE group_training_plan_id=${scope.groupTrainingPlanId}`
          await tx`DELETE FROM group_session_prescriptions WHERE microcycle_id IN (
            SELECT mi.id FROM microcycles mi
            JOIN mesocycles me ON me.id=mi.mesocycle_id
            JOIN macrocycles ma ON ma.id=me.macrocycle_id
            WHERE ma.group_training_plan_id=${scope.groupTrainingPlanId})`
          await tx`DELETE FROM sessions WHERE team_id=${scope.teamId}`
          await tx`DELETE FROM microcycle_intensity_targets WHERE id LIKE ${ID+'-micro-%-target'}`
          await tx`DELETE FROM session_generation_preferences WHERE id=${ID+'-prefs'}`
          await tx`DELETE FROM intensity_strategies WHERE id=${ID+'-intensity'}`
          await tx`DELETE FROM load_strategies WHERE id=${ID+'-load'}`
          await tx`DELETE FROM microcycles WHERE id LIKE ${ID+'-micro-%'}`
          await tx`DELETE FROM mesocycles WHERE macrocycle_id=${ID+'-macro'}`
          await tx`DELETE FROM macrocycles WHERE id=${ID+'-macro'}`
          await tx`DELETE FROM group_training_plans WHERE id=${scope.groupTrainingPlanId}`
          await tx`DELETE FROM athlete_groups WHERE id=${scope.groupId}`
          await tx`DELETE FROM teams WHERE id=${scope.teamId}`
        })
      }
      process.stdout.write('Cleanup complete; diagnostics '+filename+'\\n')
      return
    }
    assert.equal(exists.length===1 || mode==='setup',true,'Fixture must be setup before verify')
    process.stdout.write(JSON.stringify(await verify(sql),null,2)+'\\n')
  } finally {await sql.end()}
}
main().catch(e=>{process.stderr.write(String(e)+'\\n');process.exitCode=1})
