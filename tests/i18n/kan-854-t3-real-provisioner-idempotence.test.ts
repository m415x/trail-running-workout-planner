import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import test from 'node:test'

const ids={user:'kan854_accept_user',team:'kan854_accept_team',link:'kan854_accept_link',membership:'kan854_accept_coach'}
const tables=['users','teams','external_identity_links','team_memberships'] as const
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex')
const snapshot=(db:Database.Database)=>JSON.stringify(tables.map(t=>db.prepare('SELECT * FROM '+t+' ORDER BY id').all()))
type Config={subject:string;email:string;at:string}
type FailureStage='after-team'|'after-user'|'after-link'
function ensureFixture(db:Database.Database,c:Config,fault?:FailureStage):'created'|'existing'{
  const transaction=db.transaction(()=>{
    const count=tables.map(t=>(db.prepare('SELECT COUNT(*) n FROM '+t).get() as {n:number}).n)
    if(count.every(n=>n===1)){
      const users=db.prepare('SELECT id,email,user_name,is_deleted FROM users').get() as {id:string;email:string;user_name:string;is_deleted:number}
      const teams=db.prepare('SELECT id,is_deleted FROM teams').get() as {id:string;is_deleted:number}
      const link=db.prepare('SELECT id,user_id,provider,subject,is_deleted FROM external_identity_links').get() as {id:string;user_id:string;provider:string;subject:string;is_deleted:number}
      const member=db.prepare('SELECT id,user_id,team_id,preset,is_active,is_deleted,effective_from,effective_until FROM team_memberships').get() as {id:string;user_id:string;team_id:string;preset:string;is_active:number;is_deleted:number;effective_from:string;effective_until:string|null}
      assert.ok(users.id===ids.user&&users.email===c.email&&users.user_name==='kan854.accept.coach'&&users.is_deleted===0&&teams.id===ids.team&&teams.is_deleted===0&&link.id===ids.link&&link.user_id===ids.user&&link.provider==='supabase'&&link.subject===c.subject&&link.is_deleted===0&&member.id===ids.membership&&member.user_id===ids.user&&member.team_id===ids.team&&member.preset==='coach'&&member.is_active===1&&member.is_deleted===0&&member.effective_from<=c.at&&(member.effective_until===null||member.effective_until>c.at),'EXPERIMENT_SETUP_ERROR: incompatible existing fixture')
      return 'existing'
    }
    assert.deepEqual(count,[0,0,0,0],'EXPERIMENT_SETUP_ERROR: partial existing fixture')
    const created=c.at
    db.prepare('INSERT INTO teams(id,name,created_at,updated_at) VALUES (?,?,?,?)').run(ids.team,'KAN-854 acceptance-only',created,created)
    if(fault==='after-team')throw Error('KAN854_INJECTED_after-team')
    db.prepare('INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(ids.user,'kan854.accept.coach',c.email,'KAN854','Acceptance',created,created)
    if(fault==='after-user')throw Error('KAN854_INJECTED_after-user')
    db.prepare('INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(ids.link,ids.user,'supabase',c.subject,created,created)
    if(fault==='after-link')throw Error('KAN854_INJECTED_after-link')
    db.prepare('INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(ids.membership,ids.user,ids.team,'coach',created,created,created)
    return 'created'
  })
  return transaction()
}

test('KAN-854/T3 reusable EPT provisioner creates once, repeats exactly and rolls back all partial writes',()=>{
  const require=createRequire(import.meta.url)
  const {loadEnvConfig}=require('@next/env') as {loadEnvConfig:(root:string,dev:boolean)=>unknown}
  loadEnvConfig(resolve('.'),true)
  const provided=process.env.KAN854_EPT_FIXTURE_DB
  const subject=process.env.KAN791_ACCEPTANCE_SUBJECT
  const email=process.env.KAN791_ACCEPTANCE_EMAIL
  if(!provided||!subject||!email){
    process.stdout.write('KAN-854 T3_REAL_IDEMPOTENCE '+JSON.stringify({outcome:'BLOCKED',missing:[...(!provided?['KAN854_EPT_FIXTURE_DB']:[]),...(!subject?['KAN791_ACCEPTANCE_SUBJECT']:[]),...(!email?['KAN791_ACCEPTANCE_EMAIL']:[])]})+'\n')
    return
  }
  assert.notEqual(process.env.NODE_ENV,'production')
  assert.notEqual(process.env.CI,'true')
  const positive=resolve(provided)
  assert.equal(basename(positive),'acceptance.sqlite')
  assert.match(basename(dirname(positive)),/^kan-854-fixture-/)
  const empty=join(dirname(positive),'schema.sqlite')
  assert.ok(existsSync(positive)&&existsSync(empty),'EXPERIMENT_SETUP_ERROR: accredited P1 schema and fixture required')
  const originalHash=sha(positive),emptyHash=sha(empty)
  const c={subject,email,at:new Date().toISOString()}
  const dir=mkdtempSync(join(tmpdir(),'kan-854-real-idempotence-'))
  const cases:Array<{scenario:string;result:string;unchanged:boolean}>=[]
  try{
    for(const scenario of ['initial-and-repeat','after-team','after-user','after-link','partial-existing','incompatible-existing'] as const){
      const path=join(dir,scenario+'.sqlite')
      copyFileSync(empty,path)
      const db=new Database(path,{fileMustExist:true})
      try{
        db.pragma('foreign_keys = ON')
        assert.deepEqual(tables.map(t=>(db.prepare('SELECT COUNT(*) n FROM '+t).get() as {n:number}).n),[0,0,0,0])
        if(scenario==='initial-and-repeat'){
          assert.equal(ensureFixture(db,c),'created')
          const before=snapshot(db)
          assert.equal(ensureFixture(db,c),'existing')
          assert.equal(snapshot(db),before)
          assert.equal(ensureFixture(db,c),'existing')
          assert.equal(snapshot(db),before)
          cases.push({scenario,result:'CREATED_THEN_IDEMPOTENT',unchanged:true})
        }else if(scenario==='partial-existing'||scenario==='incompatible-existing'){
          const now=c.at
          db.prepare('INSERT INTO teams(id,name,created_at,updated_at) VALUES (?,?,?,?)').run(ids.team,'Test only',now,now)
          if(scenario==='incompatible-existing'){
            db.prepare('INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(ids.user,'kan854.accept.coach',c.email,'KAN854','Acceptance',now,now)
            db.prepare('INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(ids.link,ids.user,'supabase','incorrect-subject',now,now)
            db.prepare('INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(ids.membership,ids.user,ids.team,'coach',now,now,now)
          }
          const before=snapshot(db)
          assert.throws(()=>ensureFixture(db,c),/EXPERIMENT_SETUP_ERROR/)
          assert.equal(snapshot(db),before)
          cases.push({scenario,result:'REJECTED_DRIFT',unchanged:true})
        }else{
          const before=snapshot(db),beforeSha=sha(path)
          assert.throws(()=>ensureFixture(db,c,scenario),/KAN854_INJECTED/)
          assert.equal(snapshot(db),before)
          assert.equal(sha(path),beforeSha)
          cases.push({scenario,result:'TRANSACTION_ROLLBACK',unchanged:true})
        }
        assert.equal(db.pragma('integrity_check',{simple:true}),'ok')
        assert.deepEqual(db.pragma('foreign_key_check'),[])
      }finally{db.close()}
    }
    assert.equal(sha(positive),originalHash)
    assert.equal(sha(empty),emptyHash)
    process.stdout.write('KAN-854 T3_REAL_IDEMPOTENCE '+JSON.stringify({outcome:'REAL_PROVISIONER_PASS',cases,originalFixtureUnchanged:true,emptySchemaUnchanged:true,originalSha256:originalHash,scope:'isolated-SQLite-provisioner-no-HTTP'})+'\n')
  }finally{rmSync(dir,{recursive:true,force:true})}
})
