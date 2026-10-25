import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import test from 'node:test'

const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex')
test('KAN-854/T4 builds isolated minimal SessionForm domain chain without mutating P1',()=>{
 const require=createRequire(import.meta.url)
 const {loadEnvConfig}=require('@next/env') as {loadEnvConfig:(root:string,dev:boolean)=>unknown}
 loadEnvConfig(resolve('.'),true)
 const raw=process.env.KAN854_EPT_FIXTURE_DB
 if(!raw){
  process.stdout.write('KAN-854 T4_DOMAIN_FIXTURE '+JSON.stringify({outcome:'BLOCKED',reason:'fixture-path-not-configured'})+'\n')
  return
 }
 assert.notEqual(process.env.NODE_ENV,'production')
 assert.notEqual(process.env.CI,'true')
 const source=resolve(raw)
 assert.equal(basename(source),'acceptance.sqlite')
 assert.match(basename(dirname(source)),/^kan-854-fixture-/)
 assert.ok(existsSync(source),'EXPERIMENT_SETUP_ERROR: accredited P1 missing')
 const originalSha=hash(source)
 const dir=mkdtempSync(join(tmpdir(),'kan-854-t4-domain-'))
 const target=join(dir,'acceptance-domain.sqlite')
 let keep=false
 try{
  copyFileSync(source,target)
  const db=new Database(target,{fileMustExist:true})
  try{
   db.pragma('foreign_keys = ON')
   const now=new Date().toISOString()
   const team=(db.prepare('SELECT id FROM teams').get() as {id:string}|undefined)?.id
   assert.ok(team,'EXPERIMENT_SETUP_ERROR: no Team in source')
   const group='kan854_t4_group',plan='kan854_t4_plan',macro='kan854_t4_macro',meso='kan854_t4_meso',micro='kan854_t4_micro'
   const insert=db.transaction(()=>{
    db.prepare('INSERT INTO athlete_groups(id,team_id,category_code,level_code,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(group,team,'S','2',now,now)
    db.prepare('INSERT INTO group_training_plans(id,group_id,title,created_at,updated_at) VALUES (?,?,?,?,?)').run(plan,group,'KAN854 disposable planning',now,now)
    db.prepare('INSERT INTO macrocycles(id,group_training_plan_id,title,start_date,end_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(macro,plan,'Acceptance macrocycle','2026-10-19','2026-10-25',now,now)
    db.prepare('INSERT INTO mesocycles(id,macrocycle_id,title,number,period,objective,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(meso,macro,'Acceptance mesocycle',1,'general_preparatory','Acceptance only',now,now)
    db.prepare('INSERT INTO microcycles(id,mesocycle_id,week_number,type,start_date,end_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(micro,meso,1,'base','2026-10-19','2026-10-25',now,now)
   })
   insert()
   assert.equal(db.pragma('integrity_check',{simple:true}),'ok')
   assert.deepEqual(db.pragma('foreign_key_check'),[])
   const rows=db.prepare('SELECT g.id groupId,m.id microcycleId,m.start_date startDate,m.end_date endDate FROM athlete_groups g JOIN group_training_plans p ON p.group_id=g.id JOIN macrocycles a ON a.group_training_plan_id=p.id JOIN mesocycles e ON e.macrocycle_id=a.id JOIN microcycles m ON m.mesocycle_id=e.id WHERE g.team_id=?').all(team) as Array<{groupId:string;microcycleId:string;startDate:string;endDate:string}>
   assert.equal(rows.length,1)
   const first=rows[0]!
   assert.ok(first.startDate<='2026-10-24'&&first.endDate>='2026-10-24')
   assert.equal(hash(source),originalSha)
   process.stdout.write('KAN-854 T4_DOMAIN_FIXTURE '+JSON.stringify({outcome:'DOMAIN_FIXTURE_READY',directory:dir,database:target,sourceUnchanged:true,sourceSha256:originalSha,domainSha256:hash(target),groupId:first.groupId,microcycleId:first.microcycleId,sessionDate:'2026-10-24',provenance:'persisted-disposable-test-records',http:'not-executed',serverActionBinding:'not-captured'})+'\n')
   keep=true
  }finally{db.close()}
 }finally{if(!keep)rmSync(dir,{recursive:true,force:true})}
})
