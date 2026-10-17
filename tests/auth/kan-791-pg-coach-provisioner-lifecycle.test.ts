import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'
import {inspectKan791CoachIdentity,cleanupKan791CoachIdentity} from '@/lib/auth/kan-791-provisioner-lifecycle'

test('KAN-791 P4 read-only verify and owned cleanup in rollback-only PostgreSQL transaction',async()=>{
 const url=process.env.KAN789_PG_URL
 assert.ok(url,'KAN789_PG_URL required; no SKIP')
 const target=new URL(url)
 assert.equal(target.hostname,'127.0.0.1')
 assert.equal(target.port,'55439')
 assert.equal(target.pathname,'/kan791_acceptance_v2')
 const sql=postgres(url,{max:1,prepare:false})
 const ids={userId:'kan791-p4-rollback-user',linkId:'kan791-p4-rollback-link',
  membershipId:'kan791-p4-rollback-member',teamId:'kan791-annual-pg-239-team',
  email:'kan791-p4-rollback@acceptance.invalid'}
 const subject='c734b08e-25e2-4dbd-8987-9420b96bdf44'
 try{
  await assert.rejects(sql.begin(async tx=>{
   const initial=await inspectKan791CoachIdentity(tx,{ids,subject,at:new Date().toISOString()})
   assert.equal(initial,'absent')
   const before=await tx`SELECT COUNT(*)::integer AS n FROM users WHERE id=${ids.userId}`
   assert.equal(before[0]?.n,0,'inspect must not mutate')
   // Fixture rows exist only inside this rollback transaction; do not use CLI apply.
   const at=new Date().toISOString()
   await tx`INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at)
     VALUES (${ids.userId},${ids.userId},${ids.email},'P4','Acceptance',${at},${at})`
   await tx`INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at)
     VALUES (${ids.linkId},${ids.userId},'supabase',${subject},${at},${at})`
   await tx`INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at)
     VALUES (${ids.membershipId},${ids.userId},${ids.teamId},'coach',${at},true,${at},${at})`
   assert.equal(await inspectKan791CoachIdentity(tx,{ids,subject,at}),'complete')
   await assert.rejects(cleanupKan791CoachIdentity(tx,{ids,subject:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',at}),/collision|partial|ownership/i)
   assert.deepEqual(await cleanupKan791CoachIdentity(tx,{ids,subject,at}),{state:'absent',mutated:true})
   assert.deepEqual(await cleanupKan791CoachIdentity(tx,{ids,subject,at}),{state:'absent',mutated:false})
   throw new Error('KAN791_P4_ROLLBACK')
  }),/KAN791_P4_ROLLBACK/)
  for(const [table,id] of [['users',ids.userId],['external_identity_links',ids.linkId],['team_memberships',ids.membershipId]] as const){
   // Table names are literals, not user input.
   const count=table==='users'?await sql`SELECT id FROM users WHERE id=${id}`:
    table==='external_identity_links'?await sql`SELECT id FROM external_identity_links WHERE id=${id}`:
    await sql`SELECT id FROM team_memberships WHERE id=${id}`
   assert.equal(count.length,0,table+' must not leave residue')
  }
  assert.equal((await sql`SELECT id FROM group_training_plans WHERE id=${'kan791-annual-pg-239-plan'}`).length,1,
   'annual fixture must survive')
 }finally{await sql.end()}
})
