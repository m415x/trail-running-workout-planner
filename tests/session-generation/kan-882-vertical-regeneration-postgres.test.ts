import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import postgres from 'postgres'
import { assertSafeKan878PostgresTarget } from '../../scripts/kan-878-postgres-acceptance-target'
import { reconcileAndPersistGeneratedSessionsPostgres } from '@/lib/session-generation/review-snapshot-reconciliation-writer-postgres'
import type { SharedSessionGenerationResult } from '@/types/training/session-generation.types'

const url = process.env.KAN878_PG_URL
const now = '2026-11-27T12:00:00Z'
const raw = '{"schemaVersion":2,"opaque":"preserve byte-for-byte"}'
const proposal: SharedSessionGenerationResult = { events: [{
  sharedEventKey: 'shared-a',
  session: { date: '2027-01-05', title: 'Candidate', type: 'Trail', sourceTemplateId: null, locationKey: null, trackPath: null, structure: null, notes: null },
  prescriptions: [{ generationKey: 'generation-a', slotKey: 'tuesday-base', role: 'base', warnings: [],
    prescription: { groupId: 'group-a', microcycleId: 'week-a', distanceKm: 10, durationMin: null, elevationGain: 0, intensityMethod: 'hr_zone', zone: 'Z2', referencePercentage: null, notes: null } }],
  warnings: [],
}], warnings: [] }
const empty: SharedSessionGenerationResult = { events: [], warnings: [] }
const independent: SharedSessionGenerationResult = { ...proposal, events: proposal.events.map(e=>({...e,sharedEventKey:'other-event',prescriptions:e.prescriptions.map(p=>({...p,generationKey:'other-key'}))})) }

test('KAN-882 real PG writer: vertical conflict rollback, protected scope, stable identity, audit and shared Session retirement', {
  skip: !url ? 'BLOCKED: KAN878_PG_URL absent; this is NOT PostgreSQL acceptance PASS' : false,
}, async () => {
  assertSafeKan878PostgresTarget(process.env)
  const sql=postgres(url!,{max:1,prepare:false,connect_timeout:5,idle_timeout:5})
  try {
    const [target]=await sql<{db:string}[]>`SELECT current_database() AS db`
    assert.equal(target.db,'kan878_vertical_disposable')
    // All relations are session-private TEMP. Only the canonical 0043 ALTER
    // statements are applied to the TEMP prescription table, never public.
    await sql.begin(async tx=>{
      await tx.unsafe(`
        CREATE TEMP TABLE teams(id text PRIMARY KEY,is_deleted boolean NOT NULL DEFAULT false);
        CREATE TEMP TABLE athlete_groups(id text PRIMARY KEY,team_id text NOT NULL,is_deleted boolean NOT NULL DEFAULT false);
        CREATE TEMP TABLE group_training_plans(id text PRIMARY KEY,group_id text NOT NULL,planning_cohort_id text,is_deleted boolean NOT NULL DEFAULT false);
        CREATE TEMP TABLE macrocycles(id text PRIMARY KEY,group_training_plan_id text NOT NULL,is_deleted boolean NOT NULL DEFAULT false);
        CREATE TEMP TABLE mesocycles(id text PRIMARY KEY,macrocycle_id text NOT NULL,is_deleted boolean NOT NULL DEFAULT false);
        CREATE TEMP TABLE microcycles(id text PRIMARY KEY,mesocycle_id text NOT NULL,is_deleted boolean NOT NULL DEFAULT false);
        CREATE TEMP TABLE sessions(id text PRIMARY KEY,team_id text NOT NULL,date text NOT NULL,title text NOT NULL,type text NOT NULL,workout_id text,location_key text,track_path text,structure jsonb,notes text,generation_ownership text NOT NULL,shared_event_key text UNIQUE,is_deleted boolean NOT NULL DEFAULT false,created_at text NOT NULL,updated_at text NOT NULL);
        CREATE TEMP TABLE group_session_prescriptions(id text PRIMARY KEY,session_id text NOT NULL REFERENCES sessions(id),group_id text NOT NULL,microcycle_id text NOT NULL,distance_km real,duration_min integer,elevation_gain integer,intensity_method text,zone text,reference_percentage real,notes text,generation_ownership text NOT NULL,generation_key text UNIQUE,is_deleted boolean NOT NULL DEFAULT false,created_at text NOT NULL,updated_at text NOT NULL,UNIQUE(session_id,microcycle_id));
        CREATE TEMP TABLE session_generation_modification_records(id text PRIMARY KEY,group_training_plan_id text NOT NULL,session_id text,prescription_id text,action text NOT NULL,ownership text NOT NULL,generation_key text,generation_explanation jsonb,previous_value text,new_value text,changed_by_user_id text NOT NULL,created_at text NOT NULL,updated_at text NOT NULL);
        INSERT INTO teams VALUES ('team-a',false);
        INSERT INTO athlete_groups VALUES ('group-a','team-a',false);
        INSERT INTO group_training_plans VALUES ('plan-a','group-a',NULL,false),('plan-v','group-a','cohort-v',false);
        INSERT INTO macrocycles VALUES ('macro-a','plan-a',false),('macro-v','plan-v',false);
        INSERT INTO mesocycles VALUES ('meso-a','macro-a',false),('meso-v','macro-v',false);
        INSERT INTO microcycles VALUES ('week-a','meso-a',false),('week-v','meso-v',false);
      `)
      const migration=readFileSync('drizzle/supabase/0043_group_session_vertical_prescription.sql','utf8').split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean)
      assert.equal(migration.length,2)
      for(const stmt of migration) await tx.unsafe(stmt)
      const cols=await tx<{column_name:string}[]>`SELECT column_name FROM information_schema.columns WHERE table_schema LIKE 'pg_temp_%' AND table_name='group_session_prescriptions' AND column_name IN ('primary_objective','vertical_block_json') ORDER BY column_name`
      assert.deepEqual(cols.map(x=>x.column_name),['primary_objective','vertical_block_json'])
    })
    const snapshot=async()=>[
      await sql`SELECT * FROM sessions ORDER BY id`,
      await sql`SELECT * FROM group_session_prescriptions ORDER BY id`,
      await sql`SELECT * FROM session_generation_modification_records ORDER BY id`,
    ]
    const write=(p:SharedSessionGenerationResult)=>sql.begin(async tx=>{
      await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      return reconcileAndPersistGeneratedSessionsPostgres(tx,{planId:'plan-a',teamId:'team-a',userId:'coach',proposal:p,generationExplanations:new Map(),authorizedGroupIds:new Set(['group-a']),now})
    })
    const seed=async(owner:string,deleted:boolean,key:string|null,json:string|null,objective:string|null)=>{
      await sql.begin(async tx=>{
        await tx`DELETE FROM session_generation_modification_records`
        await tx`DELETE FROM group_session_prescriptions`
        await tx`DELETE FROM sessions`
        await tx`INSERT INTO sessions(id,team_id,date,title,type,generation_ownership,shared_event_key,created_at,updated_at) VALUES ('session-a','team-a','2027-01-05','Original','Trail',${owner},'shared-a',${now},${now})`
        await tx`INSERT INTO group_session_prescriptions(id,session_id,group_id,microcycle_id,elevation_gain,primary_objective,vertical_block_json,generation_ownership,generation_key,is_deleted,created_at,updated_at) VALUES ('prescription-a','session-a','group-a','week-a',2550,${objective},${json},${owner},${key},${deleted},${now},${now})`
      })
    }
    for(const [deleted,key,json,objective,p] of [
      [false,'generation-a',raw,'elevation_gain',proposal],
      [false,'generation-a','{corrupt',null,empty],
      [false,'generation-a',null,'distance',proposal],
      [true,'old-key',raw,null,proposal],
    ] as const){
      await seed('generated',deleted,key,json,objective)
      const before=await snapshot()
      await assert.rejects(()=>write(p),/reconciliation_conflict:.*vertical/i)
      assert.deepEqual(await snapshot(),before)
    }
    for(const owner of ['manual','generated_modified']){
      await seed(owner,false,owner==='manual'?null:'generation-a',raw,'elevation_gain')
      const before=await snapshot()
      await write(empty)
      assert.deepEqual(await snapshot(),before)
      await write(independent)
      assert.deepEqual((await sql`SELECT * FROM group_session_prescriptions WHERE id='prescription-a'`)[0],before[1][0])
      const audit=await sql<{new_value:string}[]>`SELECT new_value FROM session_generation_modification_records WHERE prescription_id IS NOT NULL`
      assert.equal(audit.length,1)
      assert.equal(JSON.parse(audit[0].new_value).primaryObjective,null)
      assert.equal(JSON.parse(audit[0].new_value).verticalBlockJson,null)
      const after=await snapshot()
      await write(independent)
      assert.deepEqual(await snapshot(),after)
    }
    await seed('generated',false,'generation-a',null,null)
    await sql`INSERT INTO group_session_prescriptions(id,session_id,group_id,microcycle_id,elevation_gain,primary_objective,vertical_block_json,generation_ownership,generation_key,created_at,updated_at) VALUES ('variant-p','session-a','group-a','week-v',900,'elevation_gain',${raw},'generated_modified','variant-key',${now},${now})`
    const sibling=(await sql`SELECT * FROM group_session_prescriptions WHERE id='variant-p'`)[0]
    await write(empty)
    assert.equal((await sql`SELECT is_deleted FROM sessions WHERE id='session-a'`)[0].is_deleted,false)
    assert.deepEqual((await sql`SELECT * FROM group_session_prescriptions WHERE id='variant-p'`)[0],sibling)
    assert.equal((await sql`SELECT is_deleted FROM group_session_prescriptions WHERE id='prescription-a'`)[0].is_deleted,true)
  } finally { await sql.end() }
})
