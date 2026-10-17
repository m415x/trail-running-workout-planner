import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'
import { createPostgresIdentityEvidence } from '@/lib/auth/postgres-identity-evidence'

test('KAN-791 T6-D PostgreSQL User EPT lookup and memberships are isolated and revocation-aware',async()=>{
  const url=process.env.KAN789_PG_URL
  assert.ok(url,'KAN789_PG_URL required: no SKIP')
  const parsed=new URL(url)
  assert.equal(parsed.hostname,'127.0.0.1')
  assert.equal(parsed.port,'55439')
  assert.equal(parsed.pathname,'/kan791_regression_disposable')
  const sql=postgres(url,{max:1,prepare:false})
  const id='kan791-auth-evidence'
  const now='2026-10-15T12:00:00.000Z'
  try {
    assert.equal((await sql<{db:string}[]>`SELECT current_database() AS db`)[0]?.db,'kan791_regression_disposable')
    await sql`INSERT INTO teams(id,name,created_at,updated_at) VALUES (${id+'-team'},'Auth evidence',${now},${now})`
    await sql`INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${id+'-user'},${id+'-user'},${id+'@example.invalid'},'Auth','Evidence',${now},${now})`
    await sql`INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at)
      VALUES (${id+'-link'},${id+'-user'},'supabase',${id+'-subject'},${now},${now})`
    await sql`INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at)
      VALUES (${id+'-membership'},${id+'-user'},${id+'-team'},'coach','2026-01-01T00:00:00.000Z',true,${now},${now})`
    const evidence=createPostgresIdentityEvidence(sql)
    assert.deepEqual(await evidence.findByProviderSubject('supabase',id+'-subject'),[{
      linkId:id+'-link',userId:id+'-user',linkIsDeleted:false,userIsDeleted:false,
    }])
    assert.deepEqual(await evidence.findByProviderSubject('supabase',id+'-unknown'),[])
    const memberships=await evidence.loadMemberships(id+'-user')
    assert.equal(memberships.length,1)
    assert.equal(memberships[0]?.preset,'coach')
    assert.equal(memberships[0]?.teamId,id+'-team')
    await sql`UPDATE team_memberships SET is_active=false WHERE id=${id+'-membership'}`
    assert.equal((await evidence.loadMemberships(id+'-user'))[0]?.isActive,false)
    await sql`UPDATE external_identity_links SET is_deleted=true WHERE id=${id+'-link'}`
    assert.deepEqual(await evidence.findByProviderSubject('supabase',id+'-subject'),[{
      linkId:id+'-link',userId:id+'-user',linkIsDeleted:true,userIsDeleted:false,
    }])
  } finally {
    try {
      await sql`DELETE FROM team_memberships WHERE id=${id+'-membership'}`
      await sql`DELETE FROM external_identity_links WHERE id=${id+'-link'}`
      await sql`DELETE FROM users WHERE id=${id+'-user'}`
      await sql`DELETE FROM teams WHERE id=${id+'-team'}`
    } finally {await sql.end()}
  }
})
