import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import {createPostgresIdentityEvidence} from '@/lib/auth/postgres-identity-evidence'
import {authenticateEptLogin} from '@/lib/auth/login-flow'
import {readEptSessionAccessState} from '@/lib/auth/ept-session-access'
import {resolveActiveTeamContext} from '@/lib/authorization/active-team-context'
import {resolveAudienceDestination} from '@/lib/auth/audience-destination'
import {resolveExistingSessionLogin} from '@/lib/auth/existing-session-login'

test('KAN-791 PG identity shares H2 verified session, H3 membership and Coach destination; revocation denies',async()=>{
  const url=process.env.KAN789_PG_URL
  assert.ok(url,'KAN789_PG_URL required (no SKIP)')
  const target=new URL(url)
  assert.equal(target.hostname,'127.0.0.1')
  assert.equal(target.port,'55439')
  assert.equal(target.pathname,'/kan791_regression_disposable')
  const sql=postgres(url,{max:1,prepare:false})
  const id='kan791-pg-session-contract'
  const userId=id+'-user',teamId=id+'-team',subject=id+'-supabase-sub'
  const now='2026-10-15T12:00:00.000Z'
  try {
    await sql`INSERT INTO teams(id,name,created_at,updated_at) VALUES (${teamId},'Coach session test',${now},${now})`
    await sql`INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${userId},${userId},${id+'@example.invalid'},'Coach','Test',${now},${now})`
    await sql`INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at)
      VALUES (${id+'-link'},${userId},'supabase',${subject},${now},${now})`
    await sql`INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at)
      VALUES (${id+'-membership'},${userId},${teamId},'coach','2026-01-01T00:00:00.000Z',true,${now},${now})`
    const evidence=createPostgresIdentityEvidence(sql)
    let signouts=0
    const auth={
      signInWithPassword:async()=>({data:{session:{access_token:'present'}},error:null}),
      getClaims:async()=>({data:{claims:{sub:subject}},error:null}),
      getUser:async()=>({data:{user:{id:subject}},error:null}),
      signOut:async()=>{signouts++;return {error:null}},
    }
    const login=await authenticateEptLogin({
      auth,lookup:evidence,email:'dedicated@example.invalid',
      password:'non-production-fixture',locale:'es',returnTo:'/es/dashboard',
    })
    assert.deepEqual(login,{status:'authenticated',userId,returnTo:'/es/dashboard'})
    const access=await readEptSessionAccessState(auth,evidence)
    assert.equal(access.status,'authenticated')
    const membershipRows=await evidence.loadMemberships(userId)
    const audience=()=>{
      const team=resolveActiveTeamContext({
        persistedTeamId:null,memberships:membershipRows,onDate:now,
      })
      return resolveAudienceDestination({
        access:{status:'authenticated',userId},team,
        memberships:membershipRows,at:now,
      })
    }
    assert.deepEqual(audience(),{status:'coach',teamId})
    assert.deepEqual(resolveExistingSessionLogin({
      session:{status:'authenticated',userId},audience:audience(),locale:'es',
    }),{status:'redirect',location:'/es/dashboard'})
    await sql`UPDATE team_memberships SET is_active=false WHERE id=${id+'-membership'}`
    const revoked=await evidence.loadMemberships(userId)
    const revokedTeam=resolveActiveTeamContext({
      persistedTeamId:null,memberships:revoked,onDate:now,
    })
    assert.deepEqual(resolveAudienceDestination({
      access:{status:'authenticated',userId},team:revokedTeam,memberships:revoked,at:now,
    }),{status:'deny'})
    await sql`UPDATE external_identity_links SET is_deleted=true WHERE id=${id+'-link'}`
    assert.equal((await readEptSessionAccessState(auth,evidence)).status,'invalid')
    assert.equal(signouts,0,'read-only session check does not forge a logout')
  } finally {
    try {
      await sql`DELETE FROM team_memberships WHERE id=${id+'-membership'}`
      await sql`DELETE FROM external_identity_links WHERE id=${id+'-link'}`
      await sql`DELETE FROM users WHERE id=${userId}`
      await sql`DELETE FROM teams WHERE id=${teamId}`
    } finally {await sql.end()}
  }
})
