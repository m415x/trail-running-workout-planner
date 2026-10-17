import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'
import { createPostgresH4aEvidenceSource } from '@/lib/authorization/h4a-postgres-evidence'
import { authorizeAuthenticatedCapability } from '@/lib/authorization/authenticated-authorization'

test('KAN-791 PostgreSQL H4A Coach evidence allows own Team and denies revoked or foreign Team',async()=>{
  const url=process.env.KAN789_PG_URL
  assert.ok(url,'KAN789_PG_URL mandatory: no SKIP')
  const parsed=new URL(url)
  assert.equal(parsed.hostname,'127.0.0.1')
  assert.equal(parsed.port,'55439')
  assert.equal(parsed.pathname,'/kan791_regression_disposable')
  const sql=postgres(url,{max:1,prepare:false})
  const id='kan791-h4a-runtime'
  const teamId=id+'-team',userId=id+'-user',groupId=id+'-group'
  const now='2026-10-15T12:00:00.000Z'
  try {
    await sql`INSERT INTO teams(id,name,created_at,updated_at) VALUES (${teamId},'H4A test',${now},${now})`
    await sql`INSERT INTO athlete_groups(id,team_id,category_code,level_code,created_at,updated_at)
      VALUES (${groupId},${teamId},'trail','beginner',${now},${now})`
    await sql`INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${userId},${userId},${id+'@example.invalid'},'H4A','Test',${now},${now})`
    await sql`INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at)
      VALUES (${id+'-membership'},${userId},${teamId},'coach','2026-01-01T00:00:00.000Z',true,${now},${now})`
    const evidence=createPostgresH4aEvidenceSource(sql)
    const authorize=async(scopeTeamId:string)=>{
      const [memberships,athleteProfiles,grants]=await Promise.all([
        evidence.loadMemberships(userId,scopeTeamId),
        evidence.loadAthleteProfiles(userId,scopeTeamId),
        evidence.loadGrants(userId,scopeTeamId),
      ])
      return authorizeAuthenticatedCapability({status:'authenticated',userId},{
        teamId:scopeTeamId,capability:'planning.manage',
        resource:{teamId:scopeTeamId,sportingGroupId:groupId},at:now,
        memberships,athleteProfiles,grants,
      })
    }
    assert.deepEqual(await authorize(teamId),{allowed:true})
    assert.deepEqual(await authorize(id+'-foreign-team'),{allowed:false})
    await sql`UPDATE team_memberships SET is_active=false WHERE id=${id+'-membership'}`
    assert.deepEqual(await authorize(teamId),{allowed:false})
  } finally {
    try {
      await sql`DELETE FROM team_memberships WHERE id=${id+'-membership'}`
      await sql`DELETE FROM users WHERE id=${userId}`
      await sql`DELETE FROM athlete_groups WHERE id=${groupId}`
      await sql`DELETE FROM teams WHERE id=${teamId}`
    } finally {await sql.end()}
  }
})
