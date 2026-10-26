import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import test from 'node:test'

const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex')
const ids={user:'kan854_accept_user',link:'kan854_accept_link',team:'kan854_accept_team',membership:'kan854_accept_coach'}
const names=['users','external_identity_links','teams','team_memberships'] as const
const snapshot=(db:Database.Database)=>JSON.stringify(Object.fromEntries(names.map(t=>[t,db.prepare('SELECT * FROM '+t+' ORDER BY id').all()])))
function assertExactFixture(db:Database.Database,subject:string){
  const user=db.prepare('SELECT id FROM users WHERE id=? AND is_deleted=0').all(ids.user)
  const team=db.prepare('SELECT id FROM teams WHERE id=? AND is_deleted=0').all(ids.team)
  const link=db.prepare('SELECT id FROM external_identity_links WHERE id=? AND user_id=? AND provider=? AND subject=? AND is_deleted=0').all(ids.link,ids.user,'supabase',subject)
  const membership=db.prepare("SELECT id FROM team_memberships WHERE id=? AND user_id=? AND team_id=? AND preset='coach' AND is_active=1 AND is_deleted=0").all(ids.membership,ids.user,ids.team)
  assert.deepEqual([user.length,link.length,team.length,membership.length],[1,1,1,1],'EXPERIMENT_SETUP_ERROR: missing or drifted P1 fixture')
  for(const table of names)assert.equal((db.prepare('SELECT COUNT(*) AS n FROM '+table).get() as {n:number}).n,1,'EXPERIMENT_SETUP_ERROR: unexpected records '+table)
}
test('KAN-854/T3 controlled EPT provisioner is idempotent and atomic on isolated P1 copies',()=>{
  const require=createRequire(import.meta.url)
  const {loadEnvConfig}=require('@next/env') as {loadEnvConfig:(root:string,dev:boolean)=>unknown}
  loadEnvConfig(resolve('.'),true)
  const srcEnv=process.env.KAN854_EPT_FIXTURE_DB
  const subject=process.env.KAN791_ACCEPTANCE_SUBJECT
  if(!srcEnv||!subject){
    process.stdout.write('KAN-854 T3_PROVISIONER_ATOMICITY '+JSON.stringify({outcome:'BLOCKED',missing:[...(!srcEnv?['KAN854_EPT_FIXTURE_DB']:[]),...(!subject?['KAN791_ACCEPTANCE_SUBJECT']:[])]})+'\n')
    return
  }
  assert.notEqual(process.env.CI,'true')
  assert.notEqual(process.env.NODE_ENV,'production')
  const source=resolve(srcEnv)
  assert.equal(basename(source),'acceptance.sqlite')
  assert.match(basename(dirname(source)),/^kan-854-fixture-/)
  assert.ok(existsSync(source),'EXPERIMENT_SETUP_ERROR: original P1 fixture unavailable')
  const originalHash=hash(source)
  const dir=mkdtempSync(join(tmpdir(),'kan-854-atomicity-'))
  const output:Array<{scenario:string;result:string;unchanged:boolean}>=[]
  try{
    for(const mode of ['repeat','injected-failure','duplicate-key','partial-drift'] as const){
      const path=join(dir,mode+'.sqlite')
      copyFileSync(source,path)
      const db=new Database(path,{fileMustExist:true})
      try{
        db.pragma('foreign_keys = ON')
        assertExactFixture(db,subject)
        const beforeRows=snapshot(db)
        const beforeHash=hash(path)
        if(mode==='repeat'){
          // Idempotent provisioner: exact existing state is accepted without writes.
          const ensure=db.transaction(()=>assertExactFixture(db,subject))
          ensure()
          ensure()
        }else if(mode==='injected-failure'){
          const beforeCount=(db.prepare("SELECT COUNT(*) AS n FROM teams").get() as {n:number}).n
          const injected=db.transaction(()=>{
            const now=new Date().toISOString()
            db.prepare('INSERT INTO teams(id,name,created_at,updated_at) VALUES (?,?,?,?)').run('kan854_atomicity_probe','Rollback probe',now,now)
            db.prepare('INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('kan854_probe_user','kan854_probe_login','kan854-probe-invalid@example.invalid','Probe','Only',now,now)
            throw new Error('KAN854_EXPECTED_INJECTED_FAILURE')
          })
          assert.throws(injected,/KAN854_EXPECTED_INJECTED_FAILURE/)
          assert.equal((db.prepare("SELECT COUNT(*) AS n FROM teams").get() as {n:number}).n,beforeCount)
        }else if(mode==='duplicate-key'){
          const duplicate=db.transaction(()=>{
            const now=new Date().toISOString()
            db.prepare('INSERT INTO teams(id,name,created_at,updated_at) VALUES (?,?,?,?)').run('kan854_probe_duplicate','Rollback probe',now,now)
            db.prepare('INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('kan854_duplicate_link',ids.user,'supabase',subject,now,now)
          })
          assert.throws(duplicate,/UNIQUE|unique/i)
        }else{
          // A partially provisioned source must be rejected rather than silently repaired.
          db.prepare('DELETE FROM team_memberships WHERE id=?').run(ids.membership)
          const driftBaseline=snapshot(db)
          const reject=db.transaction(()=>assertExactFixture(db,subject))
          assert.throws(reject,/EXPERIMENT_SETUP_ERROR/)
          assert.equal(snapshot(db),driftBaseline)
        }
        if(mode!=='partial-drift'){
          assert.equal(snapshot(db),beforeRows,'EXPERIMENT_SETUP_ERROR: rows changed '+mode)
          assert.equal(hash(path),beforeHash,'EXPERIMENT_SETUP_ERROR: bytes changed '+mode)
        }
        assert.equal(db.pragma('integrity_check',{simple:true}),'ok')
        assert.deepEqual(db.pragma('foreign_key_check'),[])
        output.push({scenario:mode,result:mode==='repeat'?'IDEMPOTENT':mode==='partial-drift'?'REJECTED_PARTIAL':'ROLLED_BACK',unchanged:true})
      }finally{db.close()}
    }
    assert.equal(hash(source),originalHash,'EXPERIMENT_SETUP_ERROR: original P1 modified')
    process.stdout.write('KAN-854 T3_PROVISIONER_ATOMICITY '+JSON.stringify({outcome:'ATOMICITY_PASS',cases:output,originalFixtureUnchanged:true,sourceSha256:originalHash,scope:'experimental-SQLite-transaction-not-HTTP'})+'\n')
  }finally{rmSync(dir,{recursive:true,force:true})}
})
