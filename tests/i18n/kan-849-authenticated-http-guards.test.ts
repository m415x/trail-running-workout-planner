import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { createRequire } from 'node:module'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import Database from 'better-sqlite3'
import { createServerClient } from '@supabase/ssr'
import { createHttpDistDir, operatorConfigSnapshot, operatorTypesSnapshot, stopNextHttpServer } from './kan-848-http-fixture'

const require = createRequire(import.meta.url)
const originalSha = '95a3614008d21a383a8fd7b97b369a0d0c7a96a0bc806c2b19071ad8647ce962'
const patchedSha = '53083187795bda3c82cbfc1245928ac6cfe64a371bf6a05f5167ccf0fb5139c3'
function sha(file: string) { return createHash('sha256').update(readFileSync(file)).digest('hex') }
function snapshot(db: Database.Database) {
  // Ignore SQLite WAL/journal bookkeeping; capture all persisted application relations deterministically.
  const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as {name:string}[]).map(x=>x.name)
  const hash = createHash('sha256')
  for (const name of names) {
    hash.update(name)
    const columns = db.pragma('table_info('+JSON.stringify(name)+')') as Array<{name:string}>
    const order = columns.map(c=>'"'+c.name.replaceAll('"','""')+'"').join(', ')
    const rows = db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'" ORDER BY '+order).all()
    hash.update(JSON.stringify(rows))
  }
  return hash.digest('hex')
}
function renderedDenyAlert(html: string): boolean {
  // Inspect the server-rendered alert rather than arbitrary RSC/Next serialized payload text.
  const alerts = html.match(new RegExp('<div\\b[^>]*\\brole=["\\\']alert["\\\'][^>]*>[\\s\\S]*?</div>', 'g')) ?? []
  return alerts.some(alert => alert.includes('No autorizado'))
}
async function freePort() {
  const server = createServer()
  return new Promise<number>((ok, fail) => {server.once('error',fail);server.listen(0,'127.0.0.1',()=>{const x=server.address();if(!x||typeof x==='string') return fail(new Error('No port'));server.close(()=>ok(x.port))})})
}
test('KAN-849/T3 authenticated HTTP Coach H2/H3/H4A scope remains fail-closed', {timeout:240000}, async()=>{
  assert.ok(process.cwd().toLowerCase().endsWith('trail-running-workout-planner-kan-849-exp'))
  const file=require.resolve('next/dist/server/lib/router-utils/resolve-routes')
  assert.equal(sha(file),patchedSha,'This regression requires the accredited experimental patch')
  const originalTypes=operatorTypesSnapshot(),originalConfig=operatorConfigSnapshot()
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const email=process.env.SUPABASE_AUTH_TEST_EMAIL
  const password=process.env.SUPABASE_AUTH_TEST_PASSWORD
  assert.equal(url,'http://127.0.0.1:54321','Only local Supabase Auth permitted')
  assert.ok(key?.startsWith('sb_publishable_')&&email?.endsWith('@example.test')&&password)
  assert.equal(process.env.SQLITE_SCENARIO_MODE,'1')
  assert.equal(process.env.EPT_IDENTITY_BACKEND,'sqlite')
  const dbPath=realpathSync(process.env.SQLITE_DATABASE_PATH!)
  assert.ok(dbPath.toLowerCase().includes('trail-running-sqlite-base-seed-'))
  assert.notEqual(dbPath.toLowerCase(),resolve('sqlite.db').toLowerCase())
  const jar=new Map<string,string>()
  const auth=createServerClient(url!,key!,{cookies:{
    getAll:()=>Array.from(jar,([name,value])=>({name,value})),
    setAll:parts=>parts.forEach(c=>{if(c.value)jar.set(c.name,c.value);else jar.delete(c.name)}),
  },auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}})
  const sign=await auth.auth.signInWithPassword({email:email!,password:password!})
  assert.ok(!sign.error&&sign.data.session, 'Verified local sign-in is mandatory: '+JSON.stringify({errorName:sign.error?.name??null,errorCode:sign.error?.code??null,httpStatus:sign.error?.status??null,sessionPresent:Boolean(sign.data.session),userPresent:Boolean(sign.data.user)}))
  const claims=await auth.auth.getClaims(),user=await auth.auth.getUser()
  assert.ok(!claims.error&&!user.error&&claims.data?.claims?.sub===user.data.user?.id)
  assert.ok(jar.size>0,'Supabase SSR login must generate session cookies')
  const db=new Database(dbPath,{fileMustExist:true})
  let fixtureReturn:()=>void=()=>{}
  const fixture=createHttpDistDir()
  const port=await freePort(),base='http://127.0.0.1:'+port
  const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','-H','127.0.0.1','-p',String(port)],{
    cwd:process.cwd(),env:{...process.env,KAN_HTTP_FIXTURE_DIST_DIR:fixture.distDir,KAN_HTTP_FIXTURE_TSCONFIG:fixture.tsconfigPath,KAN_HTTP_FIXTURE_DIAGNOSTICS:'1',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true,
  })
  let logs='',exited=false
  child.stdout?.on('data',x=>{logs+=String(x)})
  child.stderr?.on('data',x=>{logs+=String(x)})
  child.on('exit',()=>{exited=true})
  const loggedRequest=async(path:string,team:string|null)=>{
    const cookie=Array.from(jar,([n,v])=>encodeURIComponent(n)+'='+encodeURIComponent(v)).join('; ')+(team?'; ept_active_team='+encodeURIComponent(team):'')
    const response=await fetch(base+path,{redirect:'manual',headers:{cookie,host:'127.0.0.1:'+port},signal:AbortSignal.timeout(25000)})
    const body=await response.text()
    return {status:response.status,location:response.headers.get('location'),body,sessionHeaders:response.headers.getSetCookie().filter(x=>x.includes('sb-')).length}
  }
  try {
    let ready=false
    for(let i=0;i<65;i++){
      if(exited)throw new Error('Next exited: '+logs.slice(-1400))
      try{const r=await fetch(base+'/api/kan-849-h2-ready',{signal:AbortSignal.timeout(2000)});if(r.status===404){ready=true;break}}catch{}
      await delay(1000)
    }
    assert.ok(ready,'Next readiness failed: '+logs.slice(-2000))
    const link=db.prepare("SELECT l.user_id AS userId FROM external_identity_links l WHERE l.provider='supabase' AND l.subject=? AND l.is_deleted=0").all(user.data.user!.id) as Array<{userId:string}>
    assert.equal(link.length,1,'H2 mapped to exactly one persisted EPT User')
    const memberships=db.prepare("SELECT id,team_id AS teamId,is_active AS active,is_deleted AS deleted FROM team_memberships WHERE user_id=? AND is_active=1 AND is_deleted=0").all(link[0]!.userId) as Array<{id:string;teamId:string;active:number;deleted:number}>
    assert.equal(memberships.length,1,'Expected exactly one seeded Coach Team')
    const team=memberships[0]!
    const scenarios:Array<{name:string;team:string|null;prepare?:()=>void;expectAllow:boolean}>=[
      {name:'valid',team:team.teamId,expectAllow:true},
      {name:'forged',team:'team_forged_kan849',expectAllow:false},
      {name:'revoked',team:team.teamId,prepare:()=>{const r=db.prepare('UPDATE team_memberships SET is_active=0 WHERE id=?').run(team.id);assert.equal(r.changes,1)},expectAllow:false},
    ]
    const findings=[]
    for(const s of scenarios){
      s.prepare?.()
      const before=snapshot(db) // after fixture writes, before verified HTTP GET
      const response=await loggedRequest('/dashboard/athletes',s.team)
      const after=snapshot(db)
      assert.equal(after,before,s.name+' GET unexpectedly changed durable SQLite state')
      assert.notEqual(response.status,500,s.name+' server error: '+logs.slice(-1800))
      if(s.expectAllow){
        assert.equal(response.status,200,'Valid Coach must reach athletes page')
        const denyOccurrences = response.body.split('No autorizado').length - 1
        const alertPresent = /role=["']alert["']/.test(response.body)
        const alertWithDeny = /role=["']alert["'][^>]*>[\s\S]{0,600}?No autorizado/.test(response.body)
        const titlePresent = response.body.includes('<h2') && response.body.includes('Athlete')
        process.stdout.write('KAN-849 VALID_TEAM_HTTP_DIAGNOSTIC '+JSON.stringify({
          status:response.status,denyOccurrences,alertPresent,alertWithDeny,titlePresent,
          loginRedirect:Boolean(response.location?.includes('/login')),cookieHeaderCount:response.sessionHeaders,
        })+'\n')
        assert.ok(titlePresent, 'Authorized Coach must render the athletes page title')
        assert.equal(renderedDenyAlert(response.body),false,'Authorized Coach must not render a DENY alert')
      } else {
        assert.ok(response.status===307||response.status===200,'Guard must fail closed without 5xx')
        if(response.status===200) {
          const alerts = (response.body.match(/<div[^>]*role=["']alert["'][^>]*>/g)??[]).length
          const denials = response.body.split('No autorizado').length-1
          const near = response.body.indexOf('No autorizado')
          const excerpt = near>=0 ? response.body.slice(Math.max(0,near-130),Math.min(response.body.length,near+170)).replace(/[^\\x20-\\x7E]/g,' ') : null
          const hasAthleteRows = response.body.includes('<table')
          process.stdout.write('KAN-849 DENY_HTTP_DIAGNOSTIC '+JSON.stringify({scenario:s.name,status:response.status,alerts,denials,hasAthleteRows,excerpt})+'\n')
          assert.ok(renderedDenyAlert(response.body),'H3/H4A denied page must render a DENY alert (serialized text is insufficient)')
        }
        else assert.ok(response.location?.includes('/login')||response.location?.includes('/auth/'),'Denied navigation must use legitimate auth redirect')
      }
      findings.push({scenario:s.name,status:response.status,location:response.location,allow:s.expectAllow,dbUnchanged:after===before,setCookieHeaders:response.sessionHeaders})
    }
    process.stdout.write('KAN-849 AUTHENTICATED_HTTP_GUARDS '+JSON.stringify({verifiedH2:true,findings})+'\n')
    assert.ok(logs.includes('KAN-849 PROXY_STAGE '),'Real Next proxy must be exercised')
  } finally {
    try{db.prepare('UPDATE team_memberships SET is_active=1 WHERE id=?').run((db.prepare("SELECT m.id FROM team_memberships m JOIN external_identity_links l ON l.user_id=m.user_id WHERE l.subject=? AND m.is_active=0 LIMIT 1").get(user.data.user!.id) as {id:string}|undefined)?.id??'__none__')}catch{}
    await stopNextHttpServer(child)
    fixture.cleanup()
    db.close()
    assert.equal(operatorTypesSnapshot(),originalTypes)
    assert.equal(operatorConfigSnapshot(),originalConfig)
    assert.equal(sha(file),patchedSha,'Runtime hash changed unexpectedly during test')
  }
})
