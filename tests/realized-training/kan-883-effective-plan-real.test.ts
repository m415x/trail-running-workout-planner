import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { db } from '@/db'
import { resolveAthletePlanningOnDate, type PlanningResolutionPlan, type PlanningResolutionMembership, type AthletePlanningResolution } from '@/lib/planning-cohorts/planning-resolution'
import { comparePlannedSession, type PlannedSessionComparisonInput } from '@/lib/realized-training/plan-real-comparison'
import { normalizeRealizedTrainingRecord } from '@/lib/readiness/realized-training'
import type { AthletePlanRealComparison, PlanRealComparisonWindow } from '@/types/training/plan-real-comparison.types'
import type { AthleteAssignmentOverride } from '@/lib/planning-cohorts/athlete-session-adjustment'

const window = { kind: 'week', startDate: '2026-11-23', endDate: '2026-11-29' } as const
const base: PlanningResolutionPlan = { id: 'base', groupId: 'group-a', planningCohortId: null, status: 'active', isDeleted: false, macrocycles: [{ startDate: '2026-11-01', endDate: '2026-11-30', isDeleted: false }] }
const variant: PlanningResolutionPlan = { ...base, id: 'variant', planningCohortId: 'cohort-a', macrocycles: [{ startDate: '2026-11-20', endDate: '2026-11-30', isDeleted: false }] }
const memberships: PlanningResolutionMembership[] = [{ id: 'membership-a', startDate: '2026-11-01', endDate: null, isDeleted: false, cohort: { id: 'cohort-a', teamId: 'team-a', groupId: 'group-a', status: 'active', isDeleted: false, planningVariant: variant } }]
const resolvePlanning = async (date: string): Promise<AthletePlanningResolution> => resolveAthletePlanningOnDate({ athleteTeamId: 'team-a', currentGroupId: 'group-a', groupChanges: [], memberships, basePlans: [base], date })

type Reader = (input: { athleteId: string; teamId: string; window: PlanRealComparisonWindow; resolvePlanning: (date: string) => Promise<AthletePlanningResolution | null> }) => Promise<{ success: boolean; data: AthletePlanRealComparison | null }>
async function load(): Promise<Reader> {
  const path = '../../lib/realized-training/effective-plan-real-reader'
  assert.ok(existsSync('lib/realized-training/effective-plan-real-reader.ts'), 'H12 needs a shared scoped reader of effective T5 operands')
  const readerModule = await import(path) as { readEffectivePlanRealComparison: Reader }
  return readerModule.readEffectivePlanRealComparison
}

const sqlite = db.$client
assert.equal(sqlite.name, ':memory:', 'KAN-883 requires an isolated in-memory SQLite test database')
const tables = ['athlete_profiles','athlete_groups','group_training_plans','macrocycles','mesocycles','microcycles','sessions','group_session_prescriptions','athlete_session_adjustments','athlete_session_adjustment_revisions','workout_logs','workout_log_evidence']
const common = 'id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT \'now\', updated_at TEXT NOT NULL DEFAULT \'now\''
const block = JSON.stringify({ schemaVersion: 1, direction: 'ascent', repetitions: 3, coverage: 'complete', elevationGainPerRep: { meters: 850, provenance: { kind: 'coach_manual' } }, elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } } })
const partial = JSON.stringify({ ...JSON.parse(block), repetitions: 4, coverage: 'partial', elevationGainPerRep: { meters: 200, provenance: { kind: 'coach_manual' } } })

function fixture() {
  for (const table of [...tables].reverse()) sqlite.exec('DROP TABLE IF EXISTS '+table)
  sqlite.exec(`
    CREATE TABLE athlete_profiles (${common}, team_id TEXT NOT NULL, group_id TEXT, user_id TEXT, is_active INTEGER DEFAULT 1, first_name TEXT,last_name TEXT,contact_email TEXT,nick_name TEXT,dni TEXT,birthday TEXT,phone TEXT,emergency_contact TEXT,emergency_phone TEXT,physiology TEXT,medical TEXT);
    CREATE TABLE athlete_groups (${common}, team_id TEXT NOT NULL, category_code TEXT, level_code TEXT, description TEXT,is_active INTEGER DEFAULT 1);
    CREATE TABLE group_training_plans (${common},group_id TEXT NOT NULL,planning_cohort_id TEXT,source_group_training_plan_id TEXT,title TEXT,status TEXT,notes TEXT);
    CREATE TABLE macrocycles (${common},group_training_plan_id TEXT NOT NULL,start_date TEXT,end_date TEXT);
    CREATE TABLE mesocycles (${common},macrocycle_id TEXT NOT NULL);
    CREATE TABLE microcycles (${common},mesocycle_id TEXT NOT NULL,start_date TEXT,end_date TEXT);
    CREATE TABLE sessions (${common},team_id TEXT NOT NULL,workout_id TEXT,date TEXT NOT NULL,title TEXT NOT NULL,type TEXT NOT NULL,location_key TEXT,track_path TEXT,structure TEXT,notes TEXT,generation_ownership TEXT DEFAULT 'manual',shared_event_key TEXT);
    CREATE TABLE group_session_prescriptions (${common},session_id TEXT NOT NULL,group_id TEXT NOT NULL,microcycle_id TEXT NOT NULL,distance_km REAL,duration_min INTEGER,elevation_gain INTEGER,primary_objective TEXT,vertical_block_json TEXT,intensity_method TEXT,zone TEXT,reference_percentage REAL,notes TEXT,generation_ownership TEXT DEFAULT 'manual',generation_key TEXT);
    CREATE TABLE athlete_session_adjustments (${common},team_id TEXT NOT NULL,athlete_id TEXT NOT NULL,source_prescription_id TEXT NOT NULL);
    CREATE TABLE athlete_session_adjustment_revisions (${common},adjustment_id TEXT NOT NULL,state TEXT NOT NULL,payload TEXT NOT NULL,reason TEXT NOT NULL,changed_by_user_id TEXT,is_current INTEGER NOT NULL);
    CREATE TABLE workout_logs (${common},athlete_id TEXT NOT NULL,session_id TEXT,workout_id TEXT,date TEXT NOT NULL,status TEXT NOT NULL,distance_km REAL NOT NULL DEFAULT 0,duration_min REAL NOT NULL DEFAULT 0,elevation_gain INTEGER NOT NULL DEFAULT 0,avg_hr INTEGER,feeling TEXT,rpe INTEGER,athlete_notes TEXT,performed_at TEXT,logged_at TEXT NOT NULL);
    CREATE TABLE workout_log_evidence (${common},workout_log_id TEXT NOT NULL,source TEXT NOT NULL,source_activity_id TEXT,known_metric_fields TEXT NOT NULL);
    INSERT INTO athlete_profiles(id,team_id,group_id) VALUES ('a','team-a','group-a'),('other','team-a','group-a'),('foreign','team-b','group-b');
    INSERT INTO athlete_groups(id,team_id) VALUES ('group-a','team-a'),('group-b','team-b');
    INSERT INTO group_training_plans(id,group_id,planning_cohort_id) VALUES ('base','group-a',NULL),('variant','group-a','cohort-a'),('foreign-plan','group-b',NULL);
    INSERT INTO macrocycles(id,group_training_plan_id,start_date,end_date) VALUES ('ma-b','base','2026-11-01','2026-11-30'),('ma-v','variant','2026-11-20','2026-11-30'),('ma-f','foreign-plan','2026-11-01','2026-11-30');
    INSERT INTO mesocycles(id,macrocycle_id) VALUES ('me-b','ma-b'),('me-v','ma-v'),('me-f','ma-f');
    INSERT INTO microcycles(id,mesocycle_id,start_date,end_date) VALUES ('mi-b','me-b','2026-11-01','2026-11-30'),('mi-v','me-v','2026-11-20','2026-11-30'),('mi-f','me-f','2026-11-01','2026-11-30');
    INSERT INTO sessions(id,team_id,date,title,type) VALUES ('s','team-a','2026-11-25','Trail','Trail'),('sparse','team-a','2026-11-25','Base only','Trail'),('moved','team-a','2026-11-21','Moved','Trail'),('omitted','team-a','2026-11-26','Omitted','Trail'),('foreign-session','team-b','2026-11-25','Private','Trail');
  `)
  const p = sqlite.prepare('INSERT INTO group_session_prescriptions(id,session_id,group_id,microcycle_id,distance_km,duration_min,elevation_gain,primary_objective,vertical_block_json,intensity_method,zone) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
  for (const [id,s,m,gain,json] of [['pb','s','mi-b',2550,block],['pv','s','mi-v',2550,block],['ps','sparse','mi-b',2550,block],['pm','moved','mi-v',1000,partial],['po','omitted','mi-v',1000,partial]] as const) p.run(id,s,'group-a',m,12,120,gain,'elevation_gain',json,'hr_zone','Z2')
  p.run('pf','foreign-session','group-b','mi-f',99,99,9999,null,null,null,null)
  const a=sqlite.prepare('INSERT INTO athlete_session_adjustments(id,team_id,athlete_id,source_prescription_id) VALUES (?,?,?,?)')
  a.run('av','team-a','a','pv'); a.run('ab','team-a','a','pb'); a.run('am','team-a','a','pm'); a.run('ao','team-a','a','po'); a.run('ax','team-a','other','pv')
  setRevision('av',1800); setRevision('ab',100); setRevision('am',900,{kind:'rescheduled',date:'2026-11-24'}); setRevision('ao',1000,{kind:'omitted'}); setRevision('ax',555)
  sqlite.exec("INSERT INTO athlete_session_adjustment_revisions(id,adjustment_id,state,payload,reason,is_current) SELECT 'old-av',adjustment_id,state,payload,reason,0 FROM athlete_session_adjustment_revisions WHERE id='r-av'")
  const log=sqlite.prepare("INSERT INTO workout_logs(id,athlete_id,session_id,date,status,distance_km,duration_min,elevation_gain,logged_at) VALUES (?,?,?,?,?,?,?,?, 'now')")
  log.run('log-a','a','s','2026-11-25','partial',10,100,2000)
  log.run('log-m','a','moved','2026-11-24','completed',12,120,900)
  log.run('log-other','other','s','2026-11-25','completed',99,99,9999)
  log.run('log-invalid','a','foreign-session','2026-11-25','completed',99,99,9999)
  log.run('log-free','a',null,'2026-11-25','completed',5,30,0)
  const e=sqlite.prepare("INSERT INTO workout_log_evidence(id,workout_log_id,source,source_activity_id,known_metric_fields) VALUES (?,?,?,?,?)")
  for (const id of ['log-a','log-m','log-other','log-invalid','log-free']) e.run('e-'+id,id,'manual','private-'+id,JSON.stringify(['distanceKm','durationMin','elevationGainM']))
}
function setRevision(id: string, gain: number|null, assignment: AthleteAssignmentOverride = {kind:'inherit'}, state = 'active') {
  sqlite.prepare('DELETE FROM athlete_session_adjustment_revisions WHERE adjustment_id=?').run(id)
  sqlite.prepare("INSERT INTO athlete_session_adjustment_revisions(id,adjustment_id,state,payload,reason,is_current) VALUES (?,?,?,?, 'fixture',1)").run('r-'+id,id,state,JSON.stringify({dose:{distanceKm:{kind:'override',value:10},durationMin:{kind:'inherit'},elevationGain:{kind:'override',value:gain},intensity:{kind:'inherit'}},assignment}))
}
function snapshot() { return tables.map(t=>sqlite.prepare('SELECT * FROM '+t+' ORDER BY id').all()) }
async function read(reader:Reader, w:PlanRealComparisonWindow=window, planning=resolvePlanning) {
  const before=snapshot()
  sqlite.pragma('query_only = ON')
  try {
    const result=await reader({athleteId:'a',teamId:'team-a',window:w,resolvePlanning:planning})
    assert.equal(result.success,true)
    assert.ok(result.data)
    return result.data
  } finally {
    sqlite.pragma('query_only = OFF')
    assert.deepEqual(snapshot(),before)
  }
}
function item(result:AthletePlanRealComparison,id:string) {
  const row=result.items.find(x=>x.kind==='planned_session'&&x.sessionId===id)
  if(!row||row.kind!=='planned_session') assert.fail('missing planned '+id)
  return row
}

test('KAN-883 H12 real SQLite reader selects effective Variant, exact current revision, independent metrics and effective dates without writes', async()=>{
  fixture()
  const reader=await load()
  const result=await read(reader)
  const s=item(result,'s')
  assert.equal(s.planning.planId,'variant')
  assert.deepEqual(s.metrics.slice(0,3).map(x=>[x.evaluation.state,x.evaluation.absoluteDelta]),[['matched',0],['deviation',-20],['deviation',200]])
  assert.equal(s.realized?.recordId,'log-a')
  assert.equal(item(result,'moved').date,'2026-11-24')
  assert.equal(item(result,'moved').metrics.find(x=>x.name==='elevationGainM')?.evaluation.absoluteDelta,0)
  assert.deepEqual(result.items.filter(x=>x.kind==='planned_session').map(x=>x.sessionId).sort(),['moved','s'])
  assert.doesNotMatch(JSON.stringify(result),/log-other|log-invalid|foreign-session|private-log-other|private-log-invalid/)
  assert.equal(result.items.filter(x=>x.kind==='unplanned_realized').length,1)
  const earlier=await read(reader,{kind:'week',startDate:'2026-11-16',endDate:'2026-11-22'})
  assert.equal(earlier.items.some(x=>x.kind==='planned_session'&&x.sessionId==='moved'),false)
  sqlite.prepare("UPDATE sessions SET date='2026-11-18' WHERE id='s'").run()
  const fallback=await read(reader,{kind:'week',startDate:'2026-11-16',endDate:'2026-11-22'})
  assert.equal(item(fallback,'s').planning.planId,'base')
  assert.deepEqual(item(fallback,'s').metrics.find(x=>x.name==='elevationGainM')?.evaluation.planned,{state:'known',value:100,unit:'m'})
})

test('KAN-883 explicit zero, null, withdrawn, partial known total and subtotal-only never fabricate D+ while preserving other dimensions',async()=>{
  fixture()
  const reader=await load()
  for(const [gain,expected] of [[0,2000],[null,null],[1800,200]] as const){
    setRevision('av',gain)
    const s=item(await read(reader),'s')
    const metric=s.metrics.find(x=>x.name==='elevationGainM')!
    assert.equal(metric.evaluation.absoluteDelta,expected)
    if(gain===0) assert.equal(metric.evaluation.relativeDeltaPercent,null)
    if(gain===null) assert.equal(metric.evaluation.state,'not_evaluated')
    assert.equal(s.metrics[0].evaluation.state,'matched')
  }
  setRevision('av',1800,{kind:'inherit'},'withdrawn')
  assert.equal(item(await read(reader),'s').metrics.find(x=>x.name==='elevationGainM')?.evaluation.absoluteDelta,-550)
  sqlite.prepare("UPDATE group_session_prescriptions SET elevation_gain=NULL,vertical_block_json=? WHERE id='pv'").run(partial)
  const unknown=item(await read(reader),'s').metrics.find(x=>x.name==='elevationGainM')!
  assert.equal(unknown.evaluation.state,'not_evaluated')
  assert.equal(unknown.evaluation.absoluteDelta,null)
  sqlite.prepare("UPDATE group_session_prescriptions SET elevation_gain=1000 WHERE id='pv'").run()
  assert.equal(item(await read(reader),'s').metrics.find(x=>x.name==='elevationGainM')?.evaluation.absoluteDelta,1000)
  sqlite.prepare("DELETE FROM workout_log_evidence WHERE workout_log_id='log-a'").run()
  sqlite.prepare("UPDATE workout_logs SET elevation_gain=0 WHERE id='log-a'").run()
  assert.equal(item(await read(reader),'s').metrics.find(x=>x.name==='elevationGainM')?.evaluation.state,'not_evaluated')
})

test('KAN-883 authority conflicts, duplicate revisions, and unavailable planning never disclose linked evidence or choose a sparse fallback',async()=>{
  fixture()
  const reader=await load()
  sqlite.prepare("UPDATE athlete_session_adjustments SET team_id='team-b' WHERE id='av'").run()
  let result=await read(reader)
  assert.ok(result.planningLimitations.some(x=>x.status==='conflict'))
  assert.doesNotMatch(JSON.stringify(result),/log-a|private-log-a/)
  sqlite.prepare("UPDATE athlete_session_adjustments SET team_id='team-a' WHERE id='av'").run()
  sqlite.exec("INSERT INTO athlete_session_adjustment_revisions(id,adjustment_id,state,payload,reason,is_current) SELECT 'duplicate',adjustment_id,state,payload,reason,is_current FROM athlete_session_adjustment_revisions WHERE id='r-av'")
  result=await read(reader)
  assert.ok(result.planningLimitations.some(x=>x.status==='conflict'))
  assert.doesNotMatch(JSON.stringify(result),/log-a|private-log-a/)
  const before=snapshot()
  sqlite.pragma('query_only = ON')
  let denied: Awaited<ReturnType<Reader>>
  try {
    denied=await reader({athleteId:'a',teamId:'team-a',window,resolvePlanning:async()=>null})
  } finally { sqlite.pragma('query_only = OFF') }
  assert.equal(denied.success,false)
  assert.equal(denied.data,null)
  assert.deepEqual(snapshot(),before)
})

test('KAN-883 direct comparator redacts invalid linked evidence and rejects nonfinite planned operands',()=>{
  const planned:PlannedSessionComparisonInput={teamId:'team-a',athleteId:'a',date:'2026-11-25',sessionId:'s',sessionTitle:'Trail',planning:{source:'group',teamId:'team-a',groupId:'group-a',planId:'base',cohortId:null},metrics:{distanceKm:{state:'known',value:NaN,unit:'km'},durationMin:{state:'known',value:100,unit:'min'},elevationGainM:{state:'known',value:0,unit:'m'},intensity:{state:'unknown',reason:'not_prescribed',unit:null}}}
  const raw={id:'private-log',teamId:'team-a',athleteId:'other',sessionId:'s',workoutId:null,date:planned.date,status:'partial' as const,distanceKm:10,durationMin:100,elevationGainM:0,avgHrBpm:null,rpe:null,loggedAt:'now',source:'manual' as const,sourceActivityId:'private-source',knownMetricFields:['distanceKm','durationMin','elevationGainM'] as const}
  const invalid=comparePlannedSession(planned,normalizeRealizedTrainingRecord(raw))
  assert.equal(invalid.realized,null)
  assert.doesNotMatch(JSON.stringify(invalid),/private-log|private-source/)
  const valid=comparePlannedSession(planned,normalizeRealizedTrainingRecord({...raw,athleteId:'a'}))
  assert.equal(valid.metrics[0].evaluation.state,'not_evaluated')
  assert.equal(valid.metrics[1].evaluation.state,'matched')
  assert.equal(valid.metrics[2].evaluation.state,'matched')
})

test('KAN-883 Coach and SELF use the same read-only reader behind separate authorization boundaries',()=>{
  const coach=readFileSync('app/actions/realized-training-actions.ts','utf8')
  const cut=coach.slice(coach.indexOf('export async function getAthletePlanRealComparisonAction'),coach.indexOf('export async function getRealizedTrainingHistoryForAthleteAction'))
  assert.match(cut,/getAthleteById/)
  assert.match(cut,/getAthletePlanningResolutionOnDate/)
  assert.match(cut,/readEffectivePlanRealComparison/)
  const self=readFileSync('lib/athlete-stats/athlete-stats-self-comparison.ts','utf8')
  assert.match(self,/getSelfPlanningResolutionOnDate/)
  assert.match(self,/readEffectivePlanRealComparison/)
  assert.doesNotMatch(self,/getAthletePlanRealComparisonAction/)
})
