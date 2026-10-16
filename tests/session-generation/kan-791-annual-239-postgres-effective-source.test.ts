import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { generateReviewSnapshotFromEffectivePostgres } from '@/lib/session-generation/review-snapshot-generate-postgres'
import { DEFAULT_WEEKLY_TRAINING_PATTERN } from '@/lib/session-generation/default-weekly-pattern'
import { GENERATION_EXPLANATION_STAGE_ORDER } from '@/lib/session-generation/generation-explanation'
import { SESSION_GENERATION_SNAPSHOT_LIMITS } from '@/lib/session-generation/review-snapshot-limits'

const ID = 'kan791-annual-pg-239'
const NOW = '2026-10-15T12:00:00.000Z'
const START = '2027-01-04'
const scope = {
  groupTrainingPlanId: ID+'-plan',
  teamId: ID+'-team',
  groupId: ID+'-group',
  planningCohortId: null,
}
const iso = (day: number) => {
  const date = new Date(START+'T00:00:00.000Z')
  date.setUTCDate(date.getUTCDate()+day)
  return date.toISOString().slice(0,10)
}

test('KAN-791 53 persisted PG microcycles generate 239 real events with complete causal evidence', async () => {
  const url=process.env.KAN789_PG_URL
  assert.ok(url,'KAN789_PG_URL is mandatory; SKIP forbidden')
  const target=new URL(url)
  assert.equal(target.hostname,'127.0.0.1')
  assert.equal(target.port,'55439')
  assert.equal(target.pathname,'/kan789_acceptance')
  const sql=postgres(url,{max:1,prepare:false})
  const mesoIds=['a','b','c','d','e']
  try {
    assert.equal((await sql<{db:string}[]>`SELECT current_database() AS db`)[0]?.db,'kan789_acceptance')
    await sql`INSERT INTO teams (id,name,created_at,updated_at)
      VALUES (${scope.teamId},'Annual 239 disposable fixture',${NOW},${NOW})`
    await sql`INSERT INTO athlete_groups (id,team_id,category_code,level_code,created_at,updated_at)
      VALUES (${scope.groupId},${scope.teamId},'trail','beginner',${NOW},${NOW})`
    await sql`INSERT INTO group_training_plans (id,group_id,title,created_at,updated_at)
      VALUES (${scope.groupTrainingPlanId},${scope.groupId},'Annual 239',${NOW},${NOW})`
    await sql`INSERT INTO macrocycles
      (id,title,group_training_plan_id,start_date,end_date,created_at,updated_at)
      VALUES (${ID+'-macro'},'Annual',${scope.groupTrainingPlanId},${START},${iso(370)},${NOW},${NOW})`
    for(let j=0;j<mesoIds.length;j++) {
      await sql`INSERT INTO mesocycles
        (id,macrocycle_id,title,number,period,objective,created_at,updated_at)
        VALUES (${ID+'-meso-'+mesoIds[j]},${ID+'-macro'},${'Phase '+(j+1)},
          ${j+1},${j<3?'general_preparatory':'specific_preparatory'},'base',${NOW},${NOW})`
    }
    for(let i=0;i<53;i++) {
      const microcycle=ID+'-micro-'+String(i+1).padStart(2,'0')
      const volume=i<27?51:42
      await sql`INSERT INTO microcycles
        (id,mesocycle_id,week_number,type,start_date,end_date,target_volume_km,target_elevation_gain,created_at,updated_at)
        VALUES (${microcycle},${ID+'-meso-'+mesoIds[Math.floor(i/11)]},
          ${i+1},'development',${iso(i*7)},${iso(i*7+6)},${volume},700,${NOW},${NOW})`
      await sql`INSERT INTO microcycle_intensity_targets
        (id,microcycle_id,emphasis,intense_sessions_target,predominant_zone,
         reference_percentage_target,minimum_recovery_days_between_intense_sessions,field_sources,created_at,updated_at)
        VALUES (${microcycle+'-target'},${microcycle},'vo2max',1,'Z2',
          95,2,${JSON.stringify({})}::jsonb,${NOW},${NOW})`
    }
    await sql`INSERT INTO load_strategies
      (id,group_training_plan_id,goal_type,initial_weekly_volume_km,
       maximum_weekly_volume_km,sessions_per_week,maximum_weekly_increase_percentage,
       deload_percentage,field_sources,created_at,updated_at)
      VALUES (${ID+'-load'},${scope.groupTrainingPlanId},'finish',42,60,5,10,30,
        ${JSON.stringify({})}::jsonb,${NOW},${NOW})`
    await sql`INSERT INTO intensity_strategies
      (id,group_training_plan_id,goal_type,default_method,
       maximum_intense_sessions_per_week,minimum_recovery_days_between_intense_sessions,
       field_sources,created_at,updated_at)
      VALUES (${ID+'-intensity'},${scope.groupTrainingPlanId},'finish','reference_percentage',
        2,2,${JSON.stringify({})}::jsonb,${NOW},${NOW})`
    await sql`INSERT INTO session_generation_preferences
      (id,group_training_plan_id,frequency_mode,weekly_pattern,created_at,updated_at)
      VALUES (${ID+'-prefs'},${scope.groupTrainingPlanId},'auto',
        ${JSON.stringify(DEFAULT_WEEKLY_TRAINING_PATTERN.slots.map(({weekday,role})=>({weekday,role})))},
        ${NOW},${NOW})`
    const result=await sql.begin(async tx=>{
      await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      return generateReviewSnapshotFromEffectivePostgres(tx,scope)
    })
    assert.equal(result.microcycleCount,53)
    assert.equal(result.sourceManifest.generationInputCount,53)
    assert.equal(result.sessionCount,239)
    assert.equal(result.proposal.events.length,239)
    assert.equal(new Set(result.proposal.events.map(event=>event.sharedEventKey)).size,239)
    const prescriptions=result.proposal.events.flatMap(event=>event.prescriptions)
    assert.equal(prescriptions.length,239)
    assert.equal(Object.keys(result.generationExplanations).length,239)
    for(const explanation of Object.values(result.generationExplanations)) {
      assert.deepEqual(explanation.stages.map(stage=>stage.stage),[...GENERATION_EXPLANATION_STAGE_ORDER])
    }
    assert.ok(result.sessionCount<=SESSION_GENERATION_SNAPSHOT_LIMITS.maxSessions)
    assert.ok(result.microcycleCount<=SESSION_GENERATION_SNAPSHOT_LIMITS.maxMicrocycles)
    const rows=await sql<{count:number}[]>`SELECT count(*)::integer AS count
      FROM microcycles AS mi
      JOIN mesocycles AS me ON me.id=mi.mesocycle_id
      JOIN macrocycles AS ma ON ma.id=me.macrocycle_id
      WHERE ma.group_training_plan_id=${scope.groupTrainingPlanId}`
    assert.equal(rows[0]?.count,53)
  } finally {
    try {
      await sql`DELETE FROM microcycle_intensity_targets WHERE id LIKE ${ID+'-micro-%-target'}`
      await sql`DELETE FROM session_generation_preferences WHERE id=${ID+'-prefs'}`
      await sql`DELETE FROM intensity_strategies WHERE id=${ID+'-intensity'}`
      await sql`DELETE FROM load_strategies WHERE id=${ID+'-load'}`
      await sql`DELETE FROM microcycles WHERE id LIKE ${ID+'-micro-%'}`
      await sql`DELETE FROM mesocycles WHERE macrocycle_id=${ID+'-macro'}`
      await sql`DELETE FROM macrocycles WHERE id=${ID+'-macro'}`
      await sql`DELETE FROM group_training_plans WHERE id=${scope.groupTrainingPlanId}`
      await sql`DELETE FROM athlete_groups WHERE id=${scope.groupId}`
      await sql`DELETE FROM teams WHERE id=${scope.teamId}`
    } finally { await sql.end() }
  }
})
