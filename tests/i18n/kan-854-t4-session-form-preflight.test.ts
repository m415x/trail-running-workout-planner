import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import test from 'node:test'

test('KAN-854/T4 preflights real SessionForm binding and disposable domain prerequisites',()=>{
 const require=createRequire(import.meta.url)
 const {loadEnvConfig}=require('@next/env') as {loadEnvConfig:(root:string,dev:boolean)=>unknown}
 loadEnvConfig(resolve('.'),true)
 const root=resolve('.')
 const page=readFileSync(resolve(root,'app/[locale]/dashboard/sessions/new/page.tsx'),'utf8')
 const form=readFileSync(resolve(root,'features/sessions/components/SessionForm.tsx'),'utf8')
 const actions=readFileSync(resolve(root,'app/actions/session-actions.ts'),'utf8')
 assert.match(page,/getSessionFormOptions\(/)
 assert.match(page,/<SessionForm\b/)
 assert.match(form,/useActionState\(session \? updateSession : createSession, initialState\)/)
 assert.match(form,/<form action=\{handleValidatedAction\}/)
 assert.match(form,/formAction\(formData\)/)
 assert.match(actions,/export async function createSession\(/)
 assert.match(actions,/const planningAccess = await planningReadAccess\(\)/)
 const raw=process.env.KAN854_EPT_FIXTURE_DB
 if(!raw){
  process.stdout.write('KAN-854 T4_SESSION_FORM_PREFLIGHT '+JSON.stringify({outcome:'BLOCKED',reason:'fixture-path-not-provided',binding:'source-verified-not-runtime-observed'})+'\n')
  return
 }
 const dbPath=resolve(raw)
 assert.equal(basename(dbPath),'acceptance.sqlite')
 assert.match(basename(dirname(dbPath)),/^kan-854-fixture-/)
 assert.ok(existsSync(dbPath),'EXPERIMENT_SETUP_ERROR: disposable P1 fixture unavailable')
 const db=new Database(dbPath,{readonly:true,fileMustExist:true})
 try{
  db.pragma('query_only = ON')
  const count=(name:string)=>(db.prepare('SELECT COUNT(*) AS n FROM '+name).get() as {n:number}).n
  const tables=['users','external_identity_links','teams','team_memberships','athlete_groups','group_training_plans','macrocycles','mesocycles','microcycles']
  const counts=Object.fromEntries(tables.map(name=>[name,count(name)]))
  assert.equal(db.pragma('integrity_check',{simple:true}),'ok')
  assert.deepEqual(db.pragma('foreign_key_check'),[])
  const domainReady=['athlete_groups','group_training_plans','macrocycles','mesocycles','microcycles'].every(name=>counts[name]!>0)
  process.stdout.write('KAN-854 T4_SESSION_FORM_PREFLIGHT '+JSON.stringify({outcome:domainReady?'DOMAIN_FIXTURE_PRESENT':'DOMAIN_FIXTURE_MISSING',binding:'source-verified-not-runtime-observed',action:'createSession',authFixtureRows:counts['external_identity_links'],domainCounts:counts,requiresBrowserHydration:true,httpBC:'not-executed',reason:domainReady?null:'no-valid-domain-selection-established'})+'\n')
 }finally{db.close()}
})
