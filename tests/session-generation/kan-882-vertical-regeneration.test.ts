import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/db/schema'
import { reconcileAndPersistGeneratedSessionsSqlite } from '@/lib/session-generation/review-snapshot-reconciliation-writer'
import { distributeWeeklyElevation } from '@/lib/session-generation/weekly-elevation-distribution'
import { createWeeklyTrainingSlot } from '@/lib/session-generation/default-weekly-pattern'
import { explainTemplatesAndLoad } from '@/lib/session-generation/generation-explanation'
import type { SharedSessionGenerationResult } from '@/types/training/session-generation.types'

function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE teams (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE planning_cohorts (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE athlete_groups (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE group_training_plans (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, planning_cohort_id TEXT, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE macrocycles (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, start_date TEXT NOT NULL, end_date TEXT NOT NULL, target_race_name TEXT, target_race_distance_km REAL, target_race_elevation_gain INTEGER);
    CREATE TABLE mesocycles (id TEXT PRIMARY KEY, macrocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, period TEXT NOT NULL);
    CREATE TABLE microcycles (id TEXT PRIMARY KEY, mesocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, week_number INTEGER NOT NULL, type TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, target_volume_km REAL, target_elevation_gain INTEGER, target_duration_min INTEGER);
    CREATE TABLE load_strategies (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, maximum_weekly_volume_km REAL NOT NULL, initial_weekly_volume_km REAL NOT NULL);
    CREATE TABLE intensity_strategies (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, default_method TEXT NOT NULL, maximum_intense_sessions_per_week INTEGER NOT NULL);
    CREATE TABLE microcycle_intensity_targets (id TEXT PRIMARY KEY, microcycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, intense_sessions_target INTEGER NOT NULL, predominant_zone TEXT NOT NULL, emphasis TEXT NOT NULL, reference_percentage_target REAL, minimum_recovery_days_between_intense_sessions INTEGER NOT NULL);
    CREATE TABLE session_generation_preferences (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, frequency_mode TEXT NOT NULL, fixed_sessions_per_week INTEGER, weekly_pattern TEXT NOT NULL);
    CREATE TABLE workouts (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, archived_at TEXT, category TEXT NOT NULL, tags TEXT NOT NULL, title TEXT NOT NULL, type TEXT NOT NULL, distance REAL, time INTEGER, gain INTEGER, intensity_method TEXT, zone TEXT, reference_percentage REAL, notes TEXT, prescription_notes TEXT, structure TEXT, track_path TEXT, location_key TEXT);
    CREATE TABLE competition_entries (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL, date TEXT NOT NULL, distance_km REAL NOT NULL, elevation_gain_m REAL, priority TEXT NOT NULL, status TEXT NOT NULL, description TEXT);
    INSERT INTO users VALUES ('coach');
    INSERT INTO teams VALUES ('team-a');
    INSERT INTO athlete_groups VALUES ('group-a','team-a',0),('group-b','team-b',0);
    INSERT INTO group_training_plans VALUES ('plan-a','group-a',NULL,0),('plan-b','group-b',NULL,0);
    INSERT INTO macrocycles VALUES ('macro-a','plan-a',0,'2027-01-01','2027-12-31',NULL,NULL,NULL);
    INSERT INTO mesocycles VALUES ('meso-a','macro-a',0,'general_preparatory');
    INSERT INTO microcycles VALUES ('week-a','meso-a',0,1,'base','2027-01-04','2027-01-10',40,700,300);
    INSERT INTO load_strategies VALUES ('load-a','plan-a',0,100,30);
    INSERT INTO intensity_strategies VALUES ('int-a','plan-a',0,'hr_zone',2);
    INSERT INTO microcycle_intensity_targets VALUES ('target-a','week-a',0,2,'Z2','aerobic',NULL,2);
    INSERT INTO session_generation_preferences VALUES ('prefs-a','plan-a',0,'auto',NULL,'[{"weekday":"monday","role":"base"},{"weekday":"wednesday","role":"quality"},{"weekday":"saturday","role":"long"}]');
    INSERT INTO workouts VALUES ('work-a','team-a',0,NULL,'endurance','[]','Easy','Trail',10,60,300,'hr_zone','Z2',NULL,NULL,NULL,NULL,NULL,NULL);
    INSERT INTO competition_entries VALUES ('race-a','plan-a',0,'Race','2027-05-01',21,800,'A','planned',NULL);
  `)
  db.exec(readFileSync('drizzle/sqlite/0026_session_generation_review_snapshots.sql', 'utf8'))

  db.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      team_id TEXT NOT NULL, workout_id TEXT, date TEXT NOT NULL,
      title TEXT NOT NULL, type TEXT NOT NULL, location_key TEXT,
      track_path TEXT, structure TEXT, notes TEXT,
      generation_ownership TEXT NOT NULL DEFAULT 'manual', shared_event_key TEXT UNIQUE
    );
    CREATE TABLE group_session_prescriptions (
      id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      session_id TEXT NOT NULL, group_id TEXT NOT NULL, microcycle_id TEXT NOT NULL,
      distance_km REAL, duration_min INTEGER, elevation_gain INTEGER, primary_objective TEXT, vertical_block_json TEXT,
      intensity_method TEXT, zone TEXT, reference_percentage REAL,
      notes TEXT, generation_ownership TEXT NOT NULL DEFAULT 'manual',
      generation_key TEXT UNIQUE, UNIQUE(session_id, microcycle_id)
    );
    CREATE TABLE session_generation_modification_records (
      id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      group_training_plan_id TEXT NOT NULL, session_id TEXT,
      prescription_id TEXT, action TEXT NOT NULL, ownership TEXT NOT NULL,
      generation_key TEXT, generation_explanation TEXT,
      previous_value TEXT, new_value TEXT, changed_by_user_id TEXT
    );
  `)
  return db
}


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

function write(sqlite: Database.Database, p = proposal) {
  return reconcileAndPersistGeneratedSessionsSqlite({ database: drizzle(sqlite, { schema }), planId: 'plan-a', teamId: 'team-a', userId: 'coach', proposal: p, generationExplanations: new Map(), authorizedGroupIds: new Set(['group-a']), now })
}
function snapshot(sqlite: Database.Database) {
  return ['sessions','group_session_prescriptions','session_generation_modification_records'].map(t => sqlite.prepare('SELECT * FROM '+t+' ORDER BY id').all())
}
function seed(sqlite: Database.Database, owner: string, deleted = 0, key: string | null = 'generation-a', json: string | null = raw, objective: string | null = 'elevation_gain') {
  sqlite.prepare('INSERT INTO sessions(id,team_id,date,title,type,generation_ownership,shared_event_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run('session-a','team-a','2027-01-05','Original','Trail',owner,'shared-a',now,now)
  sqlite.prepare('INSERT INTO group_session_prescriptions(id,session_id,group_id,microcycle_id,elevation_gain,primary_objective,vertical_block_json,generation_ownership,generation_key,is_deleted,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run('prescription-a','session-a','group-a','week-a',2550,objective,json,owner,key,deleted,now,now)
}

test('KAN-882 null targets preserve unknown flexible D+ and known fixed contribution; zero remains explicit', () => {
  const slots = [createWeeklyTrainingSlot('tuesday','mountain'),createWeeklyTrainingSlot('thursday','base')]
  const fixed = [{ slotKey: slots[0].key, flexibility: 'fixed' as const, elevationGain: 800 }]
  const unknown = distributeWeeklyElevation(slots,null,fixed)
  assert.deepEqual(unknown.allocations.map(x=>x.elevationGain),[800,null])
  assert.equal(unknown.allocatedElevationGain,null)
  assert.equal(Reflect.get(unknown,'knownElevationGain'),800)
  assert.deepEqual(distributeWeeklyElevation(slots,0).allocations.map(x=>x.elevationGain),[0,0])
  assert.equal(distributeWeeklyElevation(slots,1200,fixed).allocatedElevationGain,1200)
  const explanation = explainTemplatesAndLoad({ templates: [], teamId:'team-a',period:'specific_preparatory',microcycleType:'development',slots,targetVolumeKm:20,targetElevationGain:null })
  assert.equal(explanation.flexibleAllocation.consequence.find(x=>x.code==='allocated_elevation_gain')?.value,null)
})

test('KAN-882 SQLite unexpected generated vertical data blocks replace, retirement and soft-deleted reactivation atomically', () => {
  for (const [deleted,key,json,objective,p] of [
    [0,'generation-a',raw,'elevation_gain',proposal],
    [0,'generation-a','{corrupt',null,empty],
    [0,'generation-a',null,'distance',proposal],
    [1,'old-key',raw,null,proposal],
  ] as const) {
    const sqlite=fixture()
    try {
      seed(sqlite,'generated',deleted,key,json,objective)
      const before=snapshot(sqlite)
      assert.throws(()=>write(sqlite,p),/reconciliation_conflict:.*vertical/i)
      assert.deepEqual(snapshot(sqlite),before)
    } finally { sqlite.close() }
  }
})

test('KAN-882 SQLite protected prescriptions preserve opaque bytes; independent regeneration and audit remain idempotent', () => {
  for (const owner of ['manual','generated_modified']) {
    const sqlite=fixture()
    try {
      seed(sqlite,owner,0,owner==='manual'?null:'generation-a')
      const before=snapshot(sqlite)
      write(sqlite,empty)
      assert.deepEqual(snapshot(sqlite),before)
      const independent = { ...proposal, events: proposal.events.map(e=>({...e,sharedEventKey:'other-event',prescriptions:e.prescriptions.map(p=>({...p,generationKey:'other-key'}))})) }
      write(sqlite,independent)
      assert.deepEqual(sqlite.prepare('SELECT * FROM group_session_prescriptions WHERE id=?').get('prescription-a'),before[1][0])
      const audit=sqlite.prepare("SELECT new_value FROM session_generation_modification_records WHERE prescription_id IS NOT NULL").all() as {new_value:string}[]
      assert.equal(audit.length,1)
      assert.equal(JSON.parse(audit[0].new_value).primaryObjective,null)
      assert.equal(JSON.parse(audit[0].new_value).verticalBlockJson,null)
      const after = snapshot(sqlite)
      write(sqlite,independent)
      assert.deepEqual(snapshot(sqlite), after)
      assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM session_generation_modification_records').get() as {n:number}).n,2)
    } finally { sqlite.close() }
  }
})

test('KAN-882 SQLite shared Session survives retirement of generated sibling and preserves protected Base/Variant dose', () => {
  const sqlite=fixture()
  try {
    seed(sqlite,'generated',0,'generation-a',null,null)
    sqlite.exec("INSERT INTO planning_cohorts VALUES ('cohort-v'); INSERT INTO group_training_plans VALUES ('plan-v','group-a','cohort-v',0); INSERT INTO macrocycles VALUES ('macro-v','plan-v',0,'2027-01-01','2027-12-31',NULL,NULL,NULL); INSERT INTO mesocycles VALUES ('meso-v','macro-v',0,'general_preparatory'); INSERT INTO microcycles VALUES ('week-v','meso-v',0,1,'base','2027-01-04','2027-01-10',40,700,300);")
    sqlite.prepare("INSERT INTO group_session_prescriptions(id,session_id,group_id,microcycle_id,elevation_gain,primary_objective,vertical_block_json,generation_ownership,generation_key,created_at,updated_at) VALUES ('variant-p','session-a','group-a','week-v',900,'elevation_gain',?,'generated_modified','variant-key',?,?)").run(raw,now,now)
    const sibling=sqlite.prepare("SELECT * FROM group_session_prescriptions WHERE id='variant-p'").get()
    write(sqlite,empty)
    assert.equal((sqlite.prepare("SELECT is_deleted FROM sessions WHERE id='session-a'").get() as {is_deleted:number}).is_deleted,0)
    assert.deepEqual(sqlite.prepare("SELECT * FROM group_session_prescriptions WHERE id='variant-p'").get(),sibling)
    assert.equal((sqlite.prepare("SELECT is_deleted FROM group_session_prescriptions WHERE id='prescription-a'").get() as {is_deleted:number}).is_deleted,1)
  } finally { sqlite.close() }
})

// Reconciliation may update a healthy Base row without touching an unrelated
// soft-deleted corrupt vertical row in a different Session.
test('KAN-882 unrelated soft-deleted vertical row does not block independent generation', () => {
  const sqlite=fixture()
  try {
    seed(sqlite,'generated',1,'old-key','{corrupt',null)
    const before=sqlite.prepare("SELECT * FROM group_session_prescriptions WHERE id='prescription-a'").get()
    const independent = { ...proposal, events: proposal.events.map(e=>({...e,sharedEventKey:'other-event',prescriptions:e.prescriptions.map(p=>({...p,generationKey:'other-key'}))})) }
    write(sqlite,independent)
    assert.deepEqual(sqlite.prepare("SELECT * FROM group_session_prescriptions WHERE id='prescription-a'").get(),before)
    assert.equal((sqlite.prepare("SELECT count(*) AS n FROM group_session_prescriptions WHERE generation_key='other-key' AND is_deleted=0").get() as {n:number}).n,1)
  } finally { sqlite.close() }
})
