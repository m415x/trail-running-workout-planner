import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'
import { applyKan791CoachIdentity } from '@/lib/auth/kan-791-provisioner-transaction'

test('KAN-791 P3 real PostgreSQL apply is idempotent inside rollback-only acceptance transaction',async()=>{
 const url=process.env.KAN789_PG_URL
 assert.ok(url,'KAN789_PG_URL required; no SKIP')
 const target=new URL(url)
 assert.equal(target.hostname,'127.0.0.1')
 assert.equal(target.port,'55439')
 assert.equal(target.pathname,'/kan791_regression_disposable')
 const sql=postgres(url,{max:1,prepare:false})
 const subject='0d2d471b-30cb-497d-a596-5f3c96e66c1e'
 const ids={userId:'kan791-p3-rollback-user',linkId:'kan791-p3-rollback-link',
  membershipId:'kan791-p3-rollback-member',teamId:'kan791-p3-rollback-team',
  email:'kan791-p3-rollback@acceptance.invalid'}
 try {
  // Own the Team fixture inside the same rollback-only transaction.
  await assert.rejects(sql.begin(async tx=>{
   const database=await tx<{db:string}[]>`SELECT current_database() AS db`
   assert.equal(database[0]?.db,'kan791_regression_disposable')
   const at=new Date().toISOString()
   await tx`INSERT INTO teams(id,name,created_at,updated_at)
     VALUES (${ids.teamId},'KAN-791 P3 disposable rollback fixture',${at},${at})`
   const first=await applyKan791CoachIdentity(tx,{ids,subject,at:new Date().toISOString()})
   assert.deepEqual(first,{state:'complete',mutated:true})
   const second=await applyKan791CoachIdentity(tx,{ids,subject,at:new Date().toISOString()})
   assert.deepEqual(second,{state:'complete',mutated:false})
   throw new Error('KAN791_P3_ROLLBACK')
  }),/KAN791_P3_ROLLBACK/)
  assert.equal((await sql`SELECT id FROM teams WHERE id=${ids.teamId}`).length,0)
  assert.equal((await sql`SELECT id FROM users WHERE id=${ids.userId}`).length,0)
  assert.equal((await sql`SELECT id FROM external_identity_links WHERE id=${ids.linkId}`).length,0)
  assert.equal((await sql`SELECT id FROM team_memberships WHERE id=${ids.membershipId}`).length,0)
 }finally{await sql.end()}
})
