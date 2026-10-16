import assert from 'node:assert/strict'
import { config } from 'dotenv'
import postgres from 'postgres'
import { classifyKan791CoachIdentityState } from '@/lib/auth/kan-791-provisioner-state'

config({path:'.env.local'})

const ID='kan791-pg-coach-identity'
const TEAM='kan791-annual-pg-239-team'
const GROUP='kan791-annual-pg-239-group'
const USER=ID+'-user'
const LINK=ID+'-link'
const MEMBERSHIP=ID+'-membership'
const EMAIL='kan791-coach@acceptance.invalid'
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
  const subject=process.env.KAN791_AUTH_SUBJECT?.trim()
  assert.ok(subject && /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(subject),
    'KAN791_AUTH_SUBJECT must be an authentic Supabase UUID')
  const sql=postgres(url,{max:1,prepare:false})
  try{
    const outcome=await sql.begin(async tx=>{
      // Lock the designated Team to serialize competing acceptance operations.
      const teams=await tx<{id:string;name:string;isDeleted:boolean}[]>`
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
      const users=await tx<{id:string;email:string;isDeleted:boolean}[]>`
        SELECT id,email,is_deleted AS "isDeleted" FROM users
        WHERE id=${USER} OR email=${EMAIL}`
      const links=await tx<{id:string;userId:string;subject:string;provider:string;isDeleted:boolean}[]>`
        SELECT id,user_id AS "userId",subject,provider,is_deleted AS "isDeleted"
        FROM external_identity_links
        WHERE id=${LINK} OR (provider='supabase' AND subject=${subject}) OR user_id=${USER}`
      const members=await tx<{id:string;userId:string;teamId:string;preset:string;isActive:boolean;isDeleted:boolean;effectiveFrom:string;effectiveUntil:string|null}[]>`
        SELECT id,user_id AS "userId",team_id AS "teamId",preset,
          is_active AS "isActive",is_deleted AS "isDeleted",
          effective_from AS "effectiveFrom",effective_until AS "effectiveUntil" FROM team_memberships
        WHERE id=${MEMBERSHIP} OR user_id=${USER}`
      const state=classifyKan791CoachIdentityState({
        ids:{userId:USER,linkId:LINK,membershipId:MEMBERSHIP,teamId:TEAM,email:EMAIL},
        subject,at:NOW(),users,links,memberships:members,
      })
      const empty=state==='absent'
      const complete=state==='complete'
      // The subject is a user-supplied H2 fact; this script never creates Supabase Auth accounts.
      if(mode==='verify') return {mode,state:empty?'absent':'complete',teamId:TEAM,ownedIds:[USER,LINK,MEMBERSHIP]}
      if(mode==='apply'){
        if(complete) return {mode,state:'complete',mutated:false,teamId:TEAM}
        const now=NOW()
        await tx`INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at)
          VALUES (${USER},${ID},${EMAIL},'KAN791','Acceptance',${now},${now})`
        await tx`INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at)
          VALUES (${LINK},${USER},'supabase',${subject},${now},${now})`
        await tx`INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at)
          VALUES (${MEMBERSHIP},${USER},${TEAM},'coach',${now},true,${now},${now})`
        return {mode,state:'complete',mutated:true,teamId:TEAM}
      }
      if(empty) return {mode,state:'absent',mutated:false,teamId:TEAM}
      await tx`DELETE FROM team_memberships WHERE id=${MEMBERSHIP} AND user_id=${USER} AND team_id=${TEAM}`
      await tx`DELETE FROM external_identity_links WHERE id=${LINK} AND user_id=${USER} AND subject=${subject}`
      await tx`DELETE FROM users WHERE id=${USER} AND email=${EMAIL}`
      return {mode,state:'absent',mutated:true,teamId:TEAM}
    })
    console.log(JSON.stringify(outcome))
  }finally{await sql.end()}
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Identity operation failed');process.exitCode=1})
