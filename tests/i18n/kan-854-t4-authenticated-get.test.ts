import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServerClient } from '@supabase/ssr'
import { resolve } from 'node:path'
import test from 'node:test'
import { resolveKan791AcceptanceIdentity } from '../../lib/auth/kan-791-acceptance-identity'

test('KAN-854/T4 sends authentic Supabase SSR cookie only to an explicitly isolated Next origin', {timeout:60_000}, async()=>{
 const require=createRequire(import.meta.url)
 const {loadEnvConfig}=require('@next/env') as {loadEnvConfig:(dir:string,dev:boolean)=>unknown}
 loadEnvConfig(resolve('.'),true)
 const originValue=process.env.KAN854_T4_NEXT_ORIGIN?.trim()
 if(!originValue){process.stdout.write('KAN-854 T4_AUTH_GET '+JSON.stringify({outcome:'BLOCKED',reason:'isolated-next-origin-not-configured',postSent:false})+'\n');return}
 const url=new URL(originValue)
 assert.equal(url.protocol,'http:','EXPERIMENT_SETUP_ERROR: loopback HTTP required')
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname),'EXPERIMENT_SETUP_ERROR: non-loopback Next origin')
 assert.equal(url.pathname,'/')
 assert.ok(url.port,'EXPERIMENT_SETUP_ERROR: dedicated port required')
 assert.notEqual(process.env.NODE_ENV,'production')
 assert.notEqual(process.env.CI,'true')
 const required=['KAN791_ACCEPTANCE_EMAIL','KAN791_ACCEPTANCE_SUBJECT','KAN791_AUTH_TEST_PASSWORD','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] as const
 const missing=required.filter(name=>!process.env[name]?.trim())
 if(missing.length){process.stdout.write('KAN-854 T4_AUTH_GET '+JSON.stringify({outcome:'BLOCKED',reason:'credentials-not-configured',missingNames:missing,postSent:false})+'\n');return}
 const identity=resolveKan791AcceptanceIdentity({email:process.env.KAN791_ACCEPTANCE_EMAIL!,subject:process.env.KAN791_ACCEPTANCE_SUBJECT!})
 type Cookie={name:string;value:string;options?:Record<string,unknown>}
 const cookies=new Map<string,Cookie>()
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
  cookies:{getAll:()=>[...cookies.values()],setAll:(updates)=>{for(const item of updates){if(item.value)cookies.set(item.name,item as Cookie);else cookies.delete(item.name)}}},
  auth:{autoRefreshToken:false,detectSessionInUrl:false,persistSession:true},
 })
 try{
  const login=await client.auth.signInWithPassword({email:identity.email,password:process.env['KAN791_AUTH_TEST_PASSWORD']!})
  assert.ok(login.data.session&&!login.error,'EXPERIMENT_SETUP_ERROR: acceptance credentials rejected')
  const check=await client.auth.getUser()
  assert.equal(check.data.user?.id.toLowerCase(),identity.subject,'EXPERIMENT_SETUP_ERROR: unexpected authenticated subject')
  const authCookies=[...cookies.values()].filter(cookie=>cookie.name.startsWith('sb-'))
  assert.ok(authCookies.length>0,'EXPERIMENT_SETUP_ERROR: no authentic SSR cookies')
  const cookieHeader=[...cookies.values()].map(({name,value})=>encodeURIComponent(name)+'='+encodeURIComponent(value)).join('; ')
  const hops:Array<{path:string;status:number;location:string|null;setCookieNames:string[]}>=[]
  let location=new URL('/dashboard/sessions/new',url)
  const visited=new Set<string>()
  for(let i=0;i<6;i++){
   if(visited.has(location.href)){process.stdout.write('KAN-854 T4_AUTH_GET '+JSON.stringify({outcome:'ROUTING_LOOP',hops,postSent:false})+'\n');return}
   visited.add(location.href)
   const response=await fetch(location,{redirect:'manual',headers:{cookie:cookieHeader},signal:AbortSignal.timeout(15000)})
   const redirected=response.headers.get('location')
   const setCookieNames=(response.headers.getSetCookie?.()??[]).map(raw=>raw.split('=',1)[0]).filter(Boolean)
   hops.push({path:location.pathname,status:response.status,location:redirected,setCookieNames})
   if(![301,302,303,307,308].includes(response.status)||!redirected)break
   const next=new URL(redirected,location)
   assert.equal(next.origin,url.origin,'EXPERIMENT_SETUP_ERROR: cross-origin redirect forbidden')
   location=next
  }
  const last=hops[hops.length-1]
  const outcome=last?.status===200&&location.pathname.includes('/dashboard/sessions/new')?'AUTHENTICATED_ROUTE_REACHED':last?.status===200&&location.pathname.includes('/login')?'AUTH_REDIRECT':'INCONCLUSIVE'
  process.stdout.write('KAN-854 T4_AUTH_GET '+JSON.stringify({outcome,variant:process.env.KAN854_T4_RUNTIME_VARIANT??'unclassified',nextOrigin:url.origin,hops,verifiedSubject:true,authCookieCount:authCookies.length,cookieValuesLogged:false,postSent:false,serverActionBinding:'not-captured',scope:'real-SSR-auth-request-to-isolated-Next'})+'\n')
  assert.equal(outcome,'AUTHENTICATED_ROUTE_REACHED','EXPERIMENT_INCONCLUSIVE: authenticated SessionForm route not reached; no action executed')
 }finally{
  cookies.clear()
 }
})
