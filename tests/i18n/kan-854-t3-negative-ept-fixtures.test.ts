import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import test from 'node:test'
import { resolveAuthenticatedEptIdentity } from '../../lib/auth/server-session-identity'
import { requireAuthenticatedEptAction } from '../../lib/auth/require-authenticated-action'
import { resolveActiveTeamContext } from '../../lib/authorization/active-team-context'
import { authorizeEffectiveCapability } from '../../lib/authorization/effective-authorization'

const sha=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex')
type Link={linkId:string;userId:string;linkIsDeleted:boolean;userIsDeleted:boolean}
type Member={userId:string;teamId:string;preset:'assistant'|'coach';effectiveFrom:string;effectiveUntil:string|null;isActive:boolean;isDeleted:boolean}
test('KAN-854/T3 N1-N5 fail closed on independent SQLite copies without protected mutation',async()=>{
  const require=createRequire(import.meta.url)
  const {loadEnvConfig}=require('@next/env') as {loadEnvConfig:(root:string,dev:boolean)=>unknown}
  loadEnvConfig(resolve('.'),true)
  const sourceValue=process.env.KAN854_EPT_FIXTURE_DB
  const subject=process.env.KAN791_ACCEPTANCE_SUBJECT
  if(!sourceValue||!subject){
    process.stdout.write('KAN-854 T3_NEGATIVES '+JSON.stringify({outcome:'BLOCKED',missingVariables:[...(!sourceValue?['KAN854_EPT_FIXTURE_DB']:[]),...(!subject?['KAN791_ACCEPTANCE_SUBJECT']:[])]})+'\n')
    return
  }
  assert.notEqual(process.env.NODE_ENV,'production')
  assert.notEqual(process.env.CI,'true')
  const source=resolve(sourceValue)
  assert.equal(basename(source),'acceptance.sqlite')
  assert.match(basename(dirname(source)),/^kan-854-fixture-/)
  assert.ok(existsSync(source),'accredited P1 fixture must exist')
  const originalHash=sha(source)
  const root=mkdtempSync(join(tmpdir(),'kan-854-negatives-'))
  const teamA='kan854_accept_team'
  const user='kan854_accept_user'
  const cases=['N1','N2','N3','N4','N5'] as const
  const outcomes:Array<{case:string;boundary:string;result:string;unchanged:boolean}>=[]
  try {
    for(const scenario of cases){
      const path=join(root,scenario+'.sqlite')
      copyFileSync(source,path)
      const setup=new Database(path,{fileMustExist:true})
      try {
        setup.pragma('foreign_keys = ON')
        const now=new Date().toISOString()
        const member=()=>setup.prepare('SELECT user_id AS userId,team_id AS teamId,preset,effective_from AS effectiveFrom,effective_until AS effectiveUntil,is_active AS isActive,is_deleted AS isDeleted FROM team_memberships WHERE user_id=?').all(user) as Array<{userId:string;teamId:string;preset:'coach'|'assistant';effectiveFrom:string;effectiveUntil:string|null;isActive:number;isDeleted:number}>
        if(scenario==='N1')setup.prepare('DELETE FROM external_identity_links WHERE user_id=?').run(user)
        if(scenario==='N2')setup.prepare('UPDATE team_memberships SET is_active=0 WHERE user_id=?').run(user)
        if(scenario==='N3')setup.prepare("UPDATE team_memberships SET preset='assistant' WHERE user_id=?").run(user)
        if(scenario==='N4'||scenario==='N5'){
          setup.prepare('INSERT INTO teams(id,name,created_at,updated_at) VALUES (?,?,?,?)').run('kan854_other_team','KAN854 other Team',now,now)
        }
        if(scenario==='N5'){
          setup.prepare('INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('kan854_other_member',user,'kan854_other_team','coach','2020-01-01T00:00:00.000Z',now,now)
        }
        assert.equal(setup.pragma('integrity_check',{simple:true}),'ok')
        assert.deepEqual(setup.pragma('foreign_key_check'),[])
        const rows=member().map(m=>({...m,isActive:Boolean(m.isActive),isDeleted:Boolean(m.isDeleted)})) as Member[]
        setup.close()
        const before=sha(path)
        const db=new Database(path,{readonly:true,fileMustExist:true})
        try {
          db.pragma('query_only = ON')
          const lookup={findByProviderSubject:async(provider:string,s:string):Promise<Link[]>=>{
            return (db.prepare('SELECT l.id AS linkId,l.user_id AS userId,l.is_deleted AS linkIsDeleted,u.is_deleted AS userIsDeleted FROM external_identity_links l JOIN users u ON u.id=l.user_id WHERE l.provider=? AND l.subject=?').all(provider,s) as Array<{linkId:string;userId:string;linkIsDeleted:number;userIsDeleted:number}>).map(r=>({...r,linkIsDeleted:Boolean(r.linkIsDeleted),userIsDeleted:Boolean(r.userIsDeleted)}))
          }}
          const identity=await resolveAuthenticatedEptIdentity({provider:'supabase',subject},lookup)
          const access=await requireAuthenticatedEptAction({readAccess:async()=>identity})
          const activeTeam=resolveActiveTeamContext({persistedTeamId:null,memberships:rows.map(m=>({teamId:m.teamId,isActive:m.isActive,isDeleted:m.isDeleted,effectiveFrom:m.effectiveFrom,effectiveUntil:m.effectiveUntil})),onDate:new Date().toISOString()})
          const decision=scenario==='N1'||scenario==='N5'?null:authorizeEffectiveCapability({authenticatedUserId:user,teamId:teamA,capability:'planning.manage',
            resource:{teamId:scenario==='N4'?'kan854_other_team':teamA},at:new Date().toISOString(),
            memberships:rows.map(m=>({userId:m.userId,teamId:m.teamId,preset:m.preset,effectiveFrom:m.effectiveFrom,effectiveUntil:m.effectiveUntil,isActive:m.isActive})),athleteProfiles:[],grants:[]})
          if(scenario==='N1'){assert.equal(identity.status,'unlinked');assert.equal(access.status,'forbidden');assert.equal(decision,null)}
          if(scenario==='N2'){assert.equal(activeTeam.status,'invalid_context');assert.equal(decision?.allowed,false)}
          if(scenario==='N3'){assert.equal(activeTeam.status,'resolved');assert.equal(decision?.allowed,false)}
          if(scenario==='N4'){assert.equal(activeTeam.status,'resolved');assert.equal(decision?.allowed,false)}
          if(scenario==='N5'){assert.equal(activeTeam.status,'selection_required')}
          outcomes.push({case:scenario,boundary:scenario==='N1'?'H2':scenario==='N2'||scenario==='N5'?'H3':'H4A',result:scenario==='N5'?'selection_required':'DENY',unchanged:false})
        }finally{db.close()}
        const after=sha(path)
        assert.equal(after,before,'negative resolver must not mutate '+scenario)
        outcomes[outcomes.length-1]!.unchanged=true
      }finally{if(setup.open)setup.close()}
    }
    assert.equal(sha(source),originalHash,'positive fixture must remain untouched')
    process.stdout.write('KAN-854 T3_NEGATIVES '+JSON.stringify({outcome:'NEGATIVES_RESOLVER_PASS',cases:outcomes,positiveFixtureUnchanged:true,sourceSha256:originalHash,scope:'pure-H2-H3-H4A-resolvers-readonly-no-HTTP-writer'})+'\n')
  }finally{rmSync(root,{recursive:true,force:true})}
})
