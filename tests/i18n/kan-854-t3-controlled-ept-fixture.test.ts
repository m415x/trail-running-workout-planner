import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import test from 'node:test'
import { resolveKan791AcceptanceIdentity } from '../../lib/auth/kan-791-acceptance-identity'
import { resolveAuthenticatedEptIdentity } from '../../lib/auth/server-session-identity'
import { requireAuthenticatedEptAction } from '../../lib/auth/require-authenticated-action'
import { resolveActiveTeamContext } from '../../lib/authorization/active-team-context'
import { authorizeEffectiveCapability } from '../../lib/authorization/effective-authorization'

const ids={user:'kan854_accept_user',link:'kan854_accept_link',team:'kan854_accept_team',membership:'kan854_accept_coach'}
const checksum=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex')

test('KAN-854/T3 provisions only four experimental EPT records in copied disposable SQLite', {timeout:180_000},async()=>{
  const require=createRequire(import.meta.url)
  const {loadEnvConfig}=require('@next/env') as {loadEnvConfig:(path:string,dev?:boolean)=>unknown}
  const root=resolve('.')
  loadEnvConfig(root,true)
  const subject=process.env.KAN791_ACCEPTANCE_SUBJECT
  const email=process.env.KAN791_ACCEPTANCE_EMAIL
  if(!subject||!email) {
    process.stdout.write('KAN-854 T3_FIXTURE '+JSON.stringify({outcome:'BLOCKED',reason:'verified-subject-env-not-configured'})+'\n')
    return
  }
  assert.notEqual(process.env.NODE_ENV,'production')
  assert.notEqual(process.env.CI,'true')
  const identity=resolveKan791AcceptanceIdentity({subject,email})
  const dir=mkdtempSync(join(tmpdir(),'kan-854-fixture-'))
  const source=join(dir,'schema.sqlite')
  const fixture=join(dir,'acceptance.sqlite')
  const tsx=require.resolve('tsx/cli')
  let keep=false
  try {
    const upgrade=spawnSync(process.execPath,[tsx,join(root,'scripts/upgrade-sqlite.ts')],{
      cwd:root,encoding:'utf8',timeout:120000,maxBuffer:4*1024*1024,
      env:{...process.env,SQLITE_SCENARIO_MODE:'1',SQLITE_DATABASE_PATH:source,TSX_TSCONFIG_PATH:join(root,'tsconfig.json')},
    })
    assert.equal(upgrade.status,0,'EXPERIMENT_SETUP_ERROR: canonical disposable schema failed: '+upgrade.stderr)
    assert.ok(existsSync(source))
    const schemaHash=checksum(source)
    copyFileSync(source,fixture)
    const db=new Database(fixture,{fileMustExist:true})
    try{
      db.pragma('foreign_keys = ON')
      const now=new Date().toISOString()
      const before=(db.prepare("SELECT name,sql FROM sqlite_master WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY name").all())
      const beforeSchemaHash=createHash('sha256').update(JSON.stringify(before)).digest('hex')
      const entities=['users','external_identity_links','teams','team_memberships'] as const
      const counts=()=>entities.map(table=>(db.prepare('SELECT COUNT(*) AS n FROM '+table).get() as {n:number}).n)
      assert.deepEqual(counts(),[0,0,0,0])
      const provision=db.transaction(()=>{
        db.prepare('INSERT INTO teams(id,name,created_at,updated_at) VALUES (?,?,?,?)').run(ids.team,'KAN-854 acceptance-only',now,now)
        db.prepare('INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(ids.user,'kan854.accept.coach',identity.email,'KAN854','Acceptance',now,now)
        db.prepare('INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(ids.link,ids.user,'supabase',identity.subject,now,now)
        db.prepare('INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(ids.membership,ids.user,ids.team,'coach',now,now,now)
      })
      provision()
      assert.deepEqual(counts(),[1,1,1,1])
      assert.equal(db.pragma('integrity_check',{simple:true}),'ok')
      assert.deepEqual(db.pragma('foreign_key_check'),[])
      const linkLookup={findByProviderSubject:async(provider:string,sub:string)=>db.prepare('SELECT id AS linkId,user_id AS userId,is_deleted AS linkIsDeleted FROM external_identity_links WHERE provider=? AND subject=?').all(provider,sub).map(row=>({...row as object,linkIsDeleted:Boolean((row as {linkIsDeleted:number}).linkIsDeleted),userIsDeleted:false})) as Array<{linkId:string;userId:string;linkIsDeleted:boolean;userIsDeleted:boolean}>}
      const ept=await resolveAuthenticatedEptIdentity({provider:'supabase',subject:identity.subject},linkLookup)
      assert.equal(ept.status,'authenticated')
      const access=await requireAuthenticatedEptAction({readAccess:async()=>ept})
      assert.equal(access.status,'authenticated')
      const membership={teamId:ids.team,isActive:true,isDeleted:false,effectiveFrom:now,effectiveUntil:null}
      assert.equal(resolveActiveTeamContext({persistedTeamId:null,memberships:[membership],onDate:now}).status,'resolved')
      const allow=authorizeEffectiveCapability({
        authenticatedUserId:ids.user,teamId:ids.team,capability:'planning.manage',
        resource:{teamId:ids.team},at:now,
        memberships:[{userId:ids.user,teamId:ids.team,preset:'coach',effectiveFrom:now,effectiveUntil:null,isActive:true}],
        athleteProfiles:[],grants:[],
      })
      assert.equal(allow.allowed,true)
      const finalSchemaHash=createHash('sha256').update(JSON.stringify(db.prepare("SELECT name,sql FROM sqlite_master WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY name").all())).digest('hex')
      assert.equal(finalSchemaHash,beforeSchemaHash,'schema mutated by fixture')
      process.stdout.write('KAN-854 T3_FIXTURE '+JSON.stringify({outcome:'P1_PRELIMINARY_PASS',subjectProvenance:'previously-verified-real-Supabase-env',authorizationProvenance:'synthetic-disposable-EPT',directory:dir,database:fixture,schemaSourceSha256:schemaHash,schemaSqlSha256:finalSchemaHash,fixtureSha256:checksum(fixture),recordsByTable:counts(),h2:ept.status,h3:'resolved',h4aPlanning:allow.allowed,grants:0})+'\n')
      keep=true
    }finally{db.close()}
  }finally{if(!keep)rmSync(dir,{recursive:true,force:true})}
})
