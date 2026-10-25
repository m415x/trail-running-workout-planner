import assert from 'node:assert/strict'
import test from 'node:test'
import { requireAuthenticatedEptAction } from '../../lib/auth/require-authenticated-action'
import { createActiveTeamServerContext } from '../../lib/authorization/active-team-server-context'
import { createH4aActiveTeamAuthorizationBoundary } from '../../lib/authorization/h4a-active-team-authorization'
import { createH4aAuthorizationAdapter } from '../../lib/authorization/h4a-authorization-adapter'
import { executeAuthorizedSessionMutation } from '../../lib/sessions/authorized-session-mutation'

test('KAN-854/T3 integrated H2 H3 H4A deny before persistence or cookie mutation',async()=>{
 const user='accept-only-user',team='accept-only-team',other='other-team',now='2026-10-24T12:00:00.000Z'
 let mutations=0,cookieWrites=0,authCalls=0
 const cookieStore={get:(_name:string)=>undefined,set:(_name:string,_value:string,_options:unknown)=>{cookieWrites++}}
 const members=[{userId:user,teamId:team,effectiveFrom:'2020-01-01T00:00:00.000Z',effectiveUntil:null,isActive:true,isDeleted:false}]
 const context=createActiveTeamServerContext({cookies:async()=>cookieStore,loadMemberships:async()=>members,now:()=>now,secureCookies:false})
 const unlinked=await requireAuthenticatedEptAction({readAccess:async()=>({status:'unlinked',provider:'supabase',subject:'kan854-unlinked-test-subject'})})
 assert.equal(unlinked.status,'forbidden')
 const deniedTeam=await context.select(user,other)
 assert.equal(deniedTeam.status,'rejected')
 assert.equal(cookieWrites,0)
 const adapter=createH4aAuthorizationAdapter({
  loadMemberships:async()=>[{userId:user,teamId:team,preset:'assistant',effectiveFrom:'2020-01-01T00:00:00.000Z',effectiveUntil:null,isActive:true}],
  loadAthleteProfiles:async()=>[],loadGrants:async()=>[],
 })
 const boundary=createH4aActiveTeamAuthorizationBoundary({
  resolveActiveTeam:async(u)=>context.resolve(u),
  authorize:async(access,request)=>{authCalls++;return adapter.authorize(access,request)},
 })
 const requested={capability:'planning.manage' as const,resource:{teamId:team},at:now}
 const h2=await boundary.authorize(unlinked,requested)
 assert.equal(h2.allowed,false)
 assert.equal(authCalls,0)
 const h4a=await boundary.authorize({status:'authenticated',userId:user},requested)
 assert.equal(h4a.allowed,false)
 assert.equal(authCalls,1)
 const guarded=await executeAuthorizedSessionMutation({
  existingGroupIds:['one'],resultingGroupIds:['one'],
  authorizeGroup:async()=>h4a.allowed,
  mutate:()=>{mutations++},
 })
 assert.equal(guarded,false)
 assert.equal(mutations,0)
 assert.equal(cookieWrites,0)
 process.stdout.write('KAN-854 T3_INTEGRATED_DENY '+JSON.stringify({outcome:'BOUNDARY_DENY_PASS',h2Denied:true,h3SelectionRejected:true,h4aInsufficientCapabilityDenied:true,persistenceCallbacks:mutations,cookieWrites,authorizationCalls:authCalls,scope:'production-boundaries-in-memory-evidence-not-HTTP'})+'\n')
})
