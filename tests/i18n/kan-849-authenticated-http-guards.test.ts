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
function projectDocument(html: string) {
  // Next streams RSC Flight data in script tags; never treat scripts as visible text.
  const withoutScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  const withoutStyles = withoutScripts.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  const alerts = Array.from(withoutStyles.matchAll(/<div\b[^>]*role=["']alert["'][^>]*>([\s\S]*?)<\/div>/gi), match => match[1].replace(/<[^>]+>/g, '').trim())
  const rowCount = (withoutStyles.match(/<tr\b/gi) ?? []).length
  const emptyState = /<h3\b[^>]*>/.test(withoutStyles) && rowCount === 0
  const visibleDeny = alerts.some(text => text.includes('No autorizado'))
  const headings = Array.from(withoutStyles.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi), match => match[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean)
  const audienceUnavailable = /<h1\b[^>]*>Acceso no disponible<\/h1>/i.test(withoutStyles) && withoutStyles.includes('No se pudo determinar un equipo y acceso válidos.')
  return {visibleDeny,alertCount:alerts.length,rowCount,emptyState,audienceUnavailable,headingCount:headings.length,hasAthletesHeading:headings.some(h=>h.length>0),flightOnlyDenials:(html.match(/No autorizado/g)??[]).length-(withoutStyles.match(/No autorizado/g)??[]).length}
}

function expiredSessionCookieCopy(original: Map<string,string>) {
  // Exercise a legitimate refresh token by expiring ONLY the client-side session
  // expiry metadata, without fabricating a token or changing production config.
  const result = new Map(original)
  const chunks=Array.from(result.entries()).filter(([name])=>/auth-token(?:\.\d+)?$/.test(name)).sort(([a],[b])=>{
    const ai=Number(a.match(/\.(\d+)$/)?.[1]??0),bi=Number(b.match(/\.(\d+)$/)?.[1]??0)
    return ai-bi
  })
  assert.ok(chunks.length>0,'Supabase SSR session cookie must exist')
  const serialized=chunks.map(([,value])=>value).join('')
  assert.ok(serialized.startsWith('base64-'),'Expected Supabase SSR base64 session encoding')
  const decoded=JSON.parse(Buffer.from(serialized.slice(7),'base64url').toString('utf8')) as Record<string,unknown>
  assert.equal(typeof decoded.refresh_token,'string','Real refresh token must remain in encoded cookie')
  assert.equal(typeof decoded.expires_at,'number','SSR expiry metadata must exist')
  const oldExpiry=decoded.expires_at as number
  decoded.expires_at=1
  const updated='base64-'+Buffer.from(JSON.stringify(decoded),'utf8').toString('base64url')
  let offset=0
  for (let i=0;i<chunks.length;i++) {
    const [name,value]=chunks[i]!
    const next=i===chunks.length-1 ? updated.slice(offset) : updated.slice(offset,offset+value.length)
    result.set(name,next)
    offset+=next.length
  }
  assert.equal(offset,updated.length,'All session data must fit existing cookie chunks')
  return {cookies:result,oldExpiry,forcedExpiry:decoded.expires_at}
}
function applySetCookieHeaders(jar:Map<string,string>,headers:readonly string[]) {
  let applied=0
  for(const header of headers) {
    const match=/^([^=;\s]+)=([^;]*)/.exec(header)
    if(!match) continue
    const [,name,value]=match
    if(!name.startsWith('sb-')) continue
    if(/(?:^|;\s*)max-age=0(?:;|$)/i.test(header) || !value) jar.delete(name)
    else jar.set(name,value)
    applied++
  }
  return applied
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
  const fixture=createHttpDistDir()
  const port=await freePort(),base='http://127.0.0.1:'+port
  const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','-H','127.0.0.1','-p',String(port)],{
    cwd:process.cwd(),env:{...process.env,KAN_HTTP_FIXTURE_DIST_DIR:fixture.distDir,KAN_HTTP_FIXTURE_TSCONFIG:fixture.tsconfigPath,KAN_HTTP_FIXTURE_DIAGNOSTICS:'1',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true,
  })
  let logs='',exited=false
  child.stdout?.on('data',x=>{logs+=String(x)})
  child.stderr?.on('data',x=>{logs+=String(x)})
  child.on('exit',()=>{exited=true})
  let expectedAuthCookies=Array.from(jar.entries())
  const loggedRequest=async(path:string,team:string|null,requestJar:Map<string,string>=jar)=>{
    // Rebuild each request from the original verified session, never from prior response cookies.
    assert.deepEqual(Array.from(jar.entries()),expectedAuthCookies,'Session jar mutated across HTTP scenarios')
    const cookie=Array.from(requestJar,([n,v])=>encodeURIComponent(n)+'='+encodeURIComponent(v)).join('; ')+(team?'; ept_active_team='+encodeURIComponent(team):'')
    const response=await fetch(base+path,{redirect:'manual',headers:{cookie,host:'127.0.0.1:'+port},signal:AbortSignal.timeout(25000)})
    const body=await response.text()
    return {status:response.status,location:response.headers.get('location'),body,setCookies:response.headers.getSetCookie(),sessionHeaders:response.headers.getSetCookie().filter(x=>x.includes('sb-')).length}
  }
  let revokedByTest=false
  let revokedMembershipId:string|null=null
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
      {name:'revoked',team:team.teamId,prepare:()=>{const r=db.prepare('UPDATE team_memberships SET is_active=0 WHERE id=?').run(team.id);assert.equal(r.changes,1);revokedByTest=true;revokedMembershipId=team.id},expectAllow:false},
    ]
    const findings:Array<{scenario:string;status:number;location:string|null;allow:boolean;dbUnchanged:boolean;setCookieHeaders:number;visibleDeny:boolean;rowCount:number;emptyState:boolean;audienceUnavailable:boolean}>=[]
    for(const s of scenarios){
      s.prepare?.()
      const before=snapshot(db) // after fixture writes, before verified HTTP GET
      const response=await loggedRequest('/dashboard/athletes',s.team)
      const after=snapshot(db)
      assert.equal(after,before,s.name+' GET unexpectedly changed durable SQLite state')
      assert.notEqual(response.status,500,s.name+' server error: '+logs.slice(-1800))
      const presentation=projectDocument(response.body)
      // Streaming Next responses may encode navigation in Flight instead of an HTTP Location.
      const metaRefresh = Array.from(response.body.matchAll(/<meta\b[^>]*http-equiv=["']refresh["'][^>]*>/gi), m => m[0])
      const nextRedirect = response.body.includes('NEXT_REDIRECT')
      const nextNotFound = response.body.includes('NEXT_HTTP_ERROR_FALLBACK;404')
      const renderDiagnostic = {
        htmlLength:response.body.length,
        hasRootHtml:/<html\b/i.test(response.body),
        hasNextErrorBoundary:/<meta\\b[^>]+name=["']next-error["']/i.test(response.body),
        hasMetaRefresh:metaRefresh.length>0,
        hasFlightRedirect:nextRedirect,
        hasFlightNotFound:nextNotFound,
        hasMain:/<main\\b/i.test(response.body),
        htmlStartsWithDoctype:/^<!doctype html/i.test(response.body),
        responseType:response.body.startsWith('<!DOCTYPE')?'html':'other',
      }
      process.stdout.write('KAN-849 HTTP_RENDER_SHAPE '+JSON.stringify({scenario:s.name,...renderDiagnostic})+'\n')
      process.stdout.write('KAN-849 HTTP_RENDER_PROJECTION '+JSON.stringify({scenario:s.name,status:response.status,...presentation,cookieHeaders:response.sessionHeaders})+'\n')
      if(s.expectAllow){
        assert.equal(response.status,200,'Valid Coach must reach athletes page')
        assert.ok(presentation.hasAthletesHeading,'Valid Coach requires a rendered heading')
        assert.equal(presentation.visibleDeny,false,'Valid Coach must not show a rendered deny alert')
      } else {
        assert.ok(response.status===307||response.status===200,'Guard must fail closed without 5xx')
        if(response.status===200) {
          // Characterize first; enforce DENY after all three scenarios have been observed.
        } else assert.ok(response.location?.includes('/login')||response.location?.includes('/auth/'),'Denied redirect must be legitimate auth route')
      }
      findings.push({scenario:s.name,status:response.status,location:response.location,allow:s.expectAllow,dbUnchanged:after===before,setCookieHeaders:response.sessionHeaders,visibleDeny:presentation.visibleDeny,rowCount:presentation.rowCount,emptyState:presentation.emptyState,audienceUnavailable:presentation.audienceUnavailable})
    }
    // Restore the temporary revocation before checking refreshed ALLOW. The test
    // still keeps a conditional cleanup fallback for unexpected failures.
    assert.ok(revokedByTest && revokedMembershipId === team.id,'Revoked scenario must be completed')
    assert.equal(db.prepare('UPDATE team_memberships SET is_active=1 WHERE id=? AND is_active=0').run(team.id).changes,1)
    revokedByTest=false
    // Local GoTrue rotates the token legitimately. These cookies are not proxy-emitted;
    // this phase proves continued HTTP authorization after a real SDK session refresh.
    // It does NOT substitute for a separate proxy-triggered Set-Cookie regression.
    const sessionBeforeRefresh = sign.data.session!
    const priorCookieValues = Array.from(jar.entries())
    const rotated = await auth.auth.refreshSession()
    assert.ok(!rotated.error && rotated.data.session,'Local Supabase refreshSession must succeed')
    assert.notEqual(rotated.data.session!.access_token,sessionBeforeRefresh.access_token,'Refresh must rotate the access JWT')
    assert.notEqual(rotated.data.session!.refresh_token,sessionBeforeRefresh.refresh_token,'Refresh token must rotate')
    assert.notDeepEqual(Array.from(jar.entries()),priorCookieValues,'SSR cookie jar must reflect rotated session')
    const refreshedIdentity = await auth.auth.getUser()
    assert.ok(!refreshedIdentity.error && refreshedIdentity.data.user?.id===user.data.user!.id,'Rotated session must retain the same authenticated subject')
    expectedAuthCookies=Array.from(jar.entries())
    const refreshedBefore=snapshot(db)
    const refreshedValid=await loggedRequest('/dashboard/athletes',team.teamId)
    const refreshedAfter=snapshot(db)
    assert.equal(refreshedAfter,refreshedBefore,'Refresh-valid navigation must not mutate SQLite')
    const refreshedProjection=projectDocument(refreshedValid.body)
    assert.equal(refreshedValid.status,200,'Rotated session must reach the Coach page')
    assert.equal(refreshedProjection.audienceUnavailable,false,'Rotated Coach must retain authorized audience')
    assert.ok(refreshedProjection.rowCount>0,'Rotated Coach must still see seeded athletes')
    const refreshedForged=await loggedRequest('/dashboard/athletes','team_forged_kan849')
    assert.equal(snapshot(db),refreshedAfter,'Refresh-forged navigation must not mutate SQLite')
    const refreshedForgedProjection=projectDocument(refreshedForged.body)
    assert.equal(refreshedForged.status,200,'Forged active Team with refreshed session must produce the established audience screen')
    assert.equal(refreshedForgedProjection.audienceUnavailable,true,'Refresh must not enable forged Team access')
    assert.equal(refreshedForgedProjection.rowCount,0,'Refresh-forged response must not expose athlete rows')
    process.stdout.write('KAN-849 AUTH_SDK_REFRESH_HTTP '+JSON.stringify({
      accessTokenChanged:true,refreshTokenChanged:true,subjectPreserved:true,
      cookieJarChanged:true,authorizedRows:refreshedProjection.rowCount,
      forgedAudienceDenied:refreshedForgedProjection.audienceUnavailable,
      sqliteUnchanged:snapshot(db)===refreshedBefore,
      proxyTriggeredRefresh:false,
    })+'\n')

    // Proxy-owned refresh: the token pair remains genuine and untouched. Only
    // its cookie expiry metadata is forced into the past to make getClaims()
    // exercise Supabase's legitimate refresh-token exchange on the next GET.
    const expired = expiredSessionCookieCopy(jar)
    const browserJar = expired.cookies
    const proxyBefore=snapshot(db)
    const proxyFirst=await loggedRequest('/dashboard/athletes',team.teamId,browserJar)
    assert.equal(snapshot(db),proxyBefore,'Proxy refresh GET must not mutate SQLite')
    assert.equal(proxyFirst.status,200,'Proxy must preserve authorized navigation after refresh')
    assert.ok(projectDocument(proxyFirst.body).rowCount>0,'Coach must remain authorized after proxy refresh')
    assert.ok(proxyFirst.sessionHeaders>0,'Proxy must issue Supabase Set-Cookie for refreshed session')
    const changedCookies=applySetCookieHeaders(browserJar,proxyFirst.setCookies)
    assert.ok(changedCookies>0,'Browser must apply refreshed Set-Cookie values')
    const proxySecond=await loggedRequest('/dashboard/athletes',team.teamId,browserJar)
    assert.equal(proxySecond.status,200,'Browser must navigate using propagated refreshed cookies')
    assert.ok(projectDocument(proxySecond.body).rowCount>0,'Propagated cookies must retain authorized Coach data')
    const proxyForged=await loggedRequest('/dashboard/athletes','team_forged_kan849',browserJar)
    assert.equal(proxyForged.status,200)
    assert.equal(projectDocument(proxyForged.body).audienceUnavailable,true,'Refreshed proxy cookies must not authorize forged Team')
    assert.equal(projectDocument(proxyForged.body).rowCount,0,'Refreshed forged Team must not expose athlete rows')
    assert.equal(snapshot(db),proxyBefore,'Proxy refreshed navigation and forged Team must not mutate SQLite')
    process.stdout.write('KAN-849 PROXY_AUTO_REFRESH_HTTP '+JSON.stringify({
      realRefreshTokenPreserved:true,expiryMetadataForced:true,
      responseSetCookies:proxyFirst.sessionHeaders,appliedCookies:changedCookies,
      authorizedAfterRefresh:projectDocument(proxySecond.body).rowCount>0,
      forgedDenied:projectDocument(proxyForged.body).audienceUnavailable,
      sqliteUnchanged:snapshot(db)===proxyBefore,
    })+'\n')
    process.stdout.write('KAN-849 AUTHENTICATED_HTTP_GUARDS '+JSON.stringify({verifiedH2:true,findings})+'\n')
    assert.ok(logs.includes('KAN-849 PROXY_STAGE '),'Real Next proxy must be exercised')
    for(const finding of findings.filter(f=>!f.allow && f.status===200)) {
      assert.equal(finding.audienceUnavailable,true,'Invalid active Team must render the existing fail-closed audience screen: '+finding.scenario)
      assert.equal(finding.rowCount,0,'Denied audience must not expose any athlete rows: '+finding.scenario)
    }
    assert.equal(findings.filter(f=>!f.allow).length,2,'Both negative Team scenarios must be exercised')
  } finally {
    // Never reactivate an unrelated or originally inactive membership.
    try{if(revokedByTest) db.prepare('UPDATE team_memberships SET is_active=1 WHERE id=?').run(revokedMembershipId)}catch{}
    await stopNextHttpServer(child)
    fixture.cleanup()
    db.close()
    assert.equal(operatorTypesSnapshot(),originalTypes)
    assert.equal(operatorConfigSnapshot(),originalConfig)
    assert.equal(sha(file),patchedSha,'Runtime hash changed unexpectedly during test')
  }
})
