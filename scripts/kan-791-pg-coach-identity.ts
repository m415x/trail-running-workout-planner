import assert from 'node:assert/strict'
import { config } from 'dotenv'
import postgres from 'postgres'
import { inspectKan791CoachIdentity, cleanupKan791CoachIdentity } from '@/lib/auth/kan-791-provisioner-lifecycle'
import { applyKan791CoachIdentity } from '@/lib/auth/kan-791-provisioner-transaction'
import { resolveKan791AcceptanceIdentity } from '@/lib/auth/kan-791-acceptance-identity'
import { verifyKan791SupabaseIdentity } from '@/lib/auth/kan-791-supabase-identity-verification'
import { authorizeKan791ApplyBeforeDatabase } from '@/lib/auth/kan-791-apply-preflight'

config({path:'.env.local'})

const ID='kan791-pg-coach-identity'
const TEAM='kan791-annual-pg-239-team'
const GROUP='kan791-annual-pg-239-group'
const USER=ID+'-user'
const LINK=ID+'-link'
const MEMBERSHIP=ID+'-membership'
const NOW=()=>new Date().toISOString()

type Mode='verify'|'apply'|'cleanup'
async function main(){
  const mode=process.argv[2] as Mode
  assert.ok(['verify','apply','cleanup'].includes(mode),'Usage: script verify|apply|cleanup')
  const url=process.env.KAN789_PG_URL
  assert.ok(url,'KAN789_PG_URL required')
  const target=new URL(url)
  assert.equal(target.hostname,'127.0.0.1')
  assert.equal(target.port,'55439')
  assert.equal(target.pathname,'/kan789_acceptance')
  const other=process.env.SUPABASE_DATABASE_URL
  if(other){
    const p=new URL(other)
    assert.equal(p.hostname,target.hostname)
    assert.equal(p.port,target.port)
    assert.equal(p.pathname,target.pathname)
  }
  const {email,subject}=resolveKan791AcceptanceIdentity({
    email:process.env.KAN791_AUTH_TEST_EMAIL ?? '',
    subject:process.env.KAN791_AUTH_SUBJECT ?? '',
  })
  // Mutating provisioning is denied until Supabase proves the UID/email pair.
  // Verify remains offline/read-only and must not require login credentials.
  const sql=mode==='apply'
    ? await authorizeKan791ApplyBeforeDatabase({email,subject},{
        verifyIdentity:verifyKan791SupabaseIdentity,
        openDatabase:()=>postgres(url,{max:1,prepare:false}),
      })
    : postgres(url,{max:1,prepare:false})
  try{
    const outcome=await sql.begin(async tx=>{
      if(mode==='verify') await tx`SET TRANSACTION READ ONLY`
      // Mutating modes serialize on Team; read-only verify never acquires row locks.
      const teams=mode==='verify'
        ? await tx<{id:string;name:string;isDeleted:boolean}[]>`
            SELECT id,name,is_deleted AS "isDeleted" FROM teams WHERE id=${TEAM}`
        : await tx<{id:string;name:string;isDeleted:boolean}[]>`
            SELECT id,name,is_deleted AS "isDeleted" FROM teams WHERE id=${TEAM} FOR UPDATE`
      assert.equal(teams.length,1,'Expected annual fixture Team')
      assert.equal(teams[0]?.isDeleted,false,'Annual fixture Team is deleted')
      const groups=await tx<{id:string;teamId:string}[]>`
        SELECT id,team_id AS "teamId" FROM athlete_groups WHERE id=${GROUP} AND is_deleted=false`
      assert.equal(groups.length,1,'Expected annual fixture group')
      assert.equal(groups[0]?.teamId,TEAM,'Annual fixture ownership mismatch')
      const plans=await tx<{id:string}[]>`
        SELECT id FROM group_training_plans WHERE id=${'kan791-annual-pg-239-plan'} AND group_id=${GROUP}`
      assert.equal(plans.length,1,'Expected annual fixture Plan belongs to Team group')
      const input={
        ids:{userId:USER,linkId:LINK,membershipId:MEMBERSHIP,teamId:TEAM,email},
        subject,at:NOW(),
      }
      // Shared H1/H3 ownership checks for every CLI mode; no parallel SQL writers.
      if(mode==='verify') {
        const state=await inspectKan791CoachIdentity(tx,input)
        return {mode,state,teamId:TEAM,ownedIds:[USER,LINK,MEMBERSHIP]}
      }
      if(mode==='apply') {
        const result=await applyKan791CoachIdentity(tx,input)
        return {mode,...result,teamId:TEAM}
      }
      const result=await cleanupKan791CoachIdentity(tx,input)
      return {mode,...result,teamId:TEAM}
    })
    console.log(JSON.stringify(outcome))
  }finally{await sql.end()}
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Identity operation failed');process.exitCode=1})
