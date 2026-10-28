import assert from 'node:assert/strict'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve, sep } from 'node:path'
import { createServerClient } from '@supabase/ssr'
import { NextRequest } from 'next/server'
import { refreshSupabaseProxySession } from '@/lib/auth/supabase-proxy'

type Cookie = {name:string;value:string;options?:Record<string,unknown>}
const config = process.env
assert.notEqual(config.NODE_ENV,'production')
assert.notEqual(config.CI,'true')
assert.equal(config.SQLITE_SCENARIO_MODE,'1')
assert.equal(config.EPT_IDENTITY_BACKEND,'sqlite')
const fixture=config.SQLITE_DATABASE_PATH
assert.ok(fixture && existsSync(fixture),'Accredited SQLite required')
const real=realpathSync(fixture)
const temp=realpathSync(tmpdir())
const canonical=(s:string)=>process.platform==='win32'?s.toLowerCase():s
assert.ok(canonical(dirname(real)).startsWith(canonical(temp)+sep))
assert.ok(basename(dirname(real)).startsWith('trail-running-sqlite-base-seed-kan855-'))
assert.notEqual(canonical(real),canonical(resolve('sqlite.db')))

async function main() {
const envFile=resolve('../trwp-kan855-next1643/.env.local')
assert.ok(existsSync(envFile),'Fixture auth environment missing')
const { parse } = await import('dotenv')
const authEnv=parse(readFileSync(envFile))
const email=authEnv.SUPABASE_AUTH_TEST_EMAIL
const password=authEnv.SUPABASE_AUTH_TEST_PASSWORD
const subject=authEnv.SUPABASE_AUTH_TEST_SUBJECT
const appEnvFile=resolve('.env.local')
assert.ok(existsSync(appEnvFile),'Application .env.local missing')
const appEnv=parse(readFileSync(appEnvFile))
const url=appEnv.NEXT_PUBLIC_SUPABASE_URL
const key=appEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
assert.ok(email && password && subject && url && key,'Missing acceptance configuration')
if (
  (config.NEXT_PUBLIC_SUPABASE_URL && config.NEXT_PUBLIC_SUPABASE_URL !== url) ||
  (config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== key) ||
  (authEnv.NEXT_PUBLIC_SUPABASE_URL && authEnv.NEXT_PUBLIC_SUPABASE_URL !== url) ||
  (authEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && authEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== key)
) {
  throw new Error('Application and acceptance Supabase public configuration differ')
}
// The actual proxy reads process.env, whereas Next dev loads .env.local itself.
process.env.NEXT_PUBLIC_SUPABASE_URL=url
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=key
const jar=new Map<string,Cookie>()
const client=createServerClient(url,key,{
  cookies:{
    getAll:()=>Array.from(jar.values()),
    setAll:(items)=>{for(const item of items)jar.set(item.name,{name:item.name,value:item.value,options:item.options as Record<string,unknown>})},
  },
})
const signed=await client.auth.signInWithPassword({email,password})
assert.ok(!signed.error && signed.data.session,'Real Supabase sign-in rejected')
assert.equal(signed.data.user?.id,subject,'Authenticated subject drift')
const before=signed.data.session.access_token
assert.ok(before && signed.data.session.refresh_token,'Missing genuine session')
assert.ok(jar.size>0,'SSR client did not set cookies')
const cookieNames=Array.from(jar.keys()).filter(name=>name.includes('auth-token')).sort()
assert.ok(cookieNames.length>0,'SSR auth cookie absent')
const raw=cookieNames.map(name=>jar.get(name)!.value).join('')
const encoded=raw.startsWith('base64-')
const jsonText=encoded?Buffer.from(raw.slice(7),'base64url').toString('utf8'):raw
const session=JSON.parse(jsonText) as Record<string,unknown>
assert.equal(session.access_token,before,'Cookie does not match signed-in session')
assert.equal(session.refresh_token,signed.data.session.refresh_token,'Cookie refresh differs')
session.expires_at=1
session.expires_in=0
const replaced=encoded?'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'):JSON.stringify(session)
const template=cookieNames.map(name=>jar.get(name)!)
for(const name of cookieNames)jar.delete(name)
// Split into safe sized chunks preserving exact original naming scheme.
if(cookieNames.length===1)jar.set(cookieNames[0],{...template[0],value:replaced})
else {
  const chunkSize=Math.max(1,Math.ceil(replaced.length/cookieNames.length))
  cookieNames.forEach((name,index)=>jar.set(name,{...template[index],value:replaced.slice(index*chunkSize,(index+1)*chunkSize)}))
}
if (process.env.KAN855_REFRESH_HTTP_FIRST === '1') {
  assert.equal(process.env.KAN855_REFRESH_HTTP_ACCEPTANCE, '1', 'HTTP acceptance opt-in required')
  const cookieHeader = () => Array.from(jar.values()).map(c =>
    encodeURIComponent(c.name) + '=' + encodeURIComponent(c.value)
  ).join('; ')
  const incoming = await fetch('http://localhost:3000/dashboard/athletes', {
    headers: { cookie: cookieHeader() },
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  })
  assert.equal(incoming.status, 200, 'Expired-cookie HTTP request must reach authenticated athletes page')
  assert.equal(incoming.headers.get('location'), null, 'Expired-cookie request was redirected')
  assert.match(await incoming.text(), /Atletas|Athletes|atletas|athletes/, 'Protected athletes page not rendered')

  const cookieLines = incoming.headers.getSetCookie()
  const updatedNames = new Set<string>()
  for (const line of cookieLines) {
    const first = line.split(';', 1)[0] ?? ''
    const split = first.indexOf('=')
    if (split < 1) continue
    const name = decodeURIComponent(first.slice(0, split).trim())
    if (!name.includes('auth-token')) continue
    const value = decodeURIComponent(first.slice(split + 1))
    updatedNames.add(name)
    if (value) jar.set(name, { name, value })
    else jar.delete(name)
  }
  assert.ok(updatedNames.size > 0, 'HTTP proxy did not return rotated authentication Set-Cookie')

  const names = Array.from(jar.keys()).filter(n => n.includes('auth-token')).sort()
  assert.ok(names.length > 0, 'No rotated HTTP auth cookies')
  const assembled = names.map(n => jar.get(n)!.value).join('')
  const payload = assembled.startsWith('base64-')
    ? Buffer.from(assembled.slice(7), 'base64url').toString('utf8')
    : assembled
  const fresh = JSON.parse(payload) as {access_token?:string;refresh_token?:string;expires_at?:number}
  assert.ok(fresh.access_token && fresh.access_token !== before, 'HTTP access token did not rotate')
  assert.ok(fresh.refresh_token && fresh.refresh_token !== signed.data.session.refresh_token, 'HTTP refresh token did not rotate')
  assert.ok((fresh.expires_at ?? 0) > Math.floor(Date.now()/1000), 'HTTP refreshed session not current')
  const following = await fetch('http://localhost:3000/dashboard/athletes', {
    headers: {cookie: cookieHeader()},
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  })
  assert.equal(following.status, 200, 'Rotated HTTP session failed follow-up authorization')
  assert.equal(following.headers.get('location'), null, 'Follow-up request redirected')
  assert.match(await following.text(), /Atletas|Athletes|atletas|athletes/, 'Follow-up protected page absent')
  console.log(JSON.stringify({
    status: 'PASS', auth: 'real-supabase', refreshInitiatedBy: 'http-next-proxy',
    accessTokenRotated: true, refreshTokenRotated: true,
    rotatedCookieCount: updatedNames.size, httpAuthenticatedContinuation: 'PASS',
    fixture: 'verified-disposable-sqlite', mutated: false,
  }))
  return
}
const request=new NextRequest('http://localhost:3000/dashboard',{
  headers:{cookie:Array.from(jar.values()).map(c=>encodeURIComponent(c.name)+'='+encodeURIComponent(c.value)).join('; ')},
})
const result=await refreshSupabaseProxySession(request)
assert.equal(result.status,'verified','Real proxy did not verify refreshed session')
const rotated=result.response.cookies.getAll().filter(c=>c.name.includes('auth-token'))
assert.ok(rotated.length>0,'Proxy did not propagate rotated auth cookies')
const requestCookies=request.cookies.getAll().filter(c=>c.name.includes('auth-token')).sort((a,b)=>a.name.localeCompare(b.name))
const afterRaw=requestCookies.map(c=>c.value).join('')
const afterJson=afterRaw.startsWith('base64-')?Buffer.from(afterRaw.slice(7),'base64url').toString('utf8'):afterRaw
const newSession=JSON.parse(afterJson) as {access_token?:string;refresh_token?:string;expires_at?:number}
assert.ok(newSession.access_token && newSession.access_token!==before,'Access token did not rotate')
assert.ok(newSession.refresh_token && newSession.refresh_token!==signed.data.session.refresh_token,'Refresh token did not rotate')
assert.ok((newSession.expires_at??0)>Math.floor(Date.now()/1000),'Rotated session expired')
const localHttpEnabled=process.env.KAN855_REFRESH_HTTP_ACCEPTANCE==='1'
if(localHttpEnabled) {
  const origin=process.env.KAN855_REFRESH_HTTP_ORIGIN || 'http://localhost:3000'
  assert.equal(origin,'http://localhost:3000','Only the accredited local HTTP origin is allowed')
  const endpoint=origin+'/dashboard/athletes'
  const cookies=requestCookies.map(c=>encodeURIComponent(c.name)+'='+encodeURIComponent(c.value)).join('; ')
  const refreshed=await fetch(endpoint,{
    headers:{cookie:cookies},
    redirect:'manual',
    signal:AbortSignal.timeout(20_000),
  })
  assert.equal(refreshed.status,200,'Refreshed session did not reach protected athletes route')
  assert.equal(refreshed.headers.get('location'),null,'Refreshed session was redirected')
  assert.match(await refreshed.text(),/Atletas|Athletes|atletas|athletes/,'Expected protected athletes page')
}
console.log(JSON.stringify({status:'PASS',auth:'real-supabase',proxy:'verified',accessTokenRotated:true,refreshTokenRotated:true,rotatedCookieCount:rotated.length,httpAuthenticatedContinuation:localHttpEnabled?'PASS':'NOT_RUN',fixture:'verified-disposable-sqlite',mutated:false}))

}

main().catch((error: unknown) => {
  console.error('KAN-855 refresh probe DENY: ' + (error instanceof Error ? error.message : 'unknown'))
  process.exitCode = 1
})
