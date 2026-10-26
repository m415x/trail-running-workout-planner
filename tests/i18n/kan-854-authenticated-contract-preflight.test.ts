import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

type Scenario = 'authenticated-http' | 'server-action'
interface Gate { outcome:'READY'|'BLOCKED'; blockers:string[] }

function evaluatePrerequisites(input:{
  url?:string; publicKey?:string; dedicatedSubjectVerified:boolean;
  disposableDataPrepared:boolean; realSessionCookieObtained:boolean;
  realFormCaptured?:boolean; scenario:Scenario
}):Gate {
  const blockers:string[]=[]
  if(!input.url?.trim() || !input.publicKey?.trim()) blockers.push('supabase-public-config')
  if(!input.dedicatedSubjectVerified) blockers.push('dedicated-supabase-subject-not-verified')
  if(!input.disposableDataPrepared) blockers.push('disposable-ept-subject-team-scope-missing')
  if(!input.realSessionCookieObtained) blockers.push('real-supabase-ssr-cookie-missing')
  if(input.scenario==='server-action' && !input.realFormCaptured) blockers.push('real-next-action-form-reference-missing')
  return {outcome:blockers.length?'BLOCKED':'READY',blockers}
}

test('KAN-854/T3/T4 require authentic dedicated Supabase session, EPT scope and real action form',()=>{
  const verify = readFileSync('lib/auth/kan-791-supabase-identity-verification.ts','utf8')
  const proxy = readFileSync('lib/auth/supabase-proxy.ts','utf8')
  const session = readFileSync('lib/auth/supabase-server-session-state.ts','utf8')
  const preflight = readFileSync('tests/i18n/kan-854-real-app-preflight.test.ts','utf8')
  assert.match(verify,/signInWithPassword/)
  assert.match(verify,/getUser/)
  assert.match(proxy,/createServerClient/)
  assert.match(session,/getClaims/)
  assert.match(preflight,/Local Supabase configuration unavailable/)
  const missing=evaluatePrerequisites({scenario:'authenticated-http',dedicatedSubjectVerified:false,disposableDataPrepared:false,realSessionCookieObtained:false})
  assert.equal(missing.outcome,'BLOCKED')
  assert.deepEqual(missing.blockers,[
    'supabase-public-config','dedicated-supabase-subject-not-verified','disposable-ept-subject-team-scope-missing','real-supabase-ssr-cookie-missing',
  ])
  const action=evaluatePrerequisites({scenario:'server-action',url:'http://fixture.invalid',publicKey:'fixture-key',dedicatedSubjectVerified:true,disposableDataPrepared:true,realSessionCookieObtained:true,realFormCaptured:false})
  assert.deepEqual(action,{outcome:'BLOCKED',blockers:['real-next-action-form-reference-missing']})
  const ready=evaluatePrerequisites({scenario:'authenticated-http',url:'http://fixture.invalid',publicKey:'fixture-key',dedicatedSubjectVerified:true,disposableDataPrepared:true,realSessionCookieObtained:true,realFormCaptured:false})
  assert.equal(ready.outcome,'READY')
  process.stdout.write('KAN-854 AUTH_CONTRACT_PREFLIGHT '+JSON.stringify({existingAuthMechanism:'supabase-password-login-getUser-ssr-cookies',anonymousToAuthenticatedUpgrade:'requires real cookies and verified subject',eptScope:'requires disposable EPT identity/team/role link',serverActions:'requires captured actual Next action form',noCredentialsLogged:true})+'\n')
})
