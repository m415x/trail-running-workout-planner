import type postgres from 'postgres'
import {classifyKan791CoachIdentityState,type Kan791IdentityIds} from './kan-791-provisioner-state'

type Sql=ReturnType<typeof postgres>
type Tx=Parameters<Parameters<Sql['begin']>[0]>[0]

export async function applyKan791CoachIdentity(
 tx:Tx,input:{ids:Kan791IdentityIds;subject:string;at:string},
):Promise<{state:'complete';mutated:boolean}> {
 const {ids,subject,at}=input
 const users=await tx<{id:string;email:string;isDeleted:boolean}[]>`
   SELECT id,email,is_deleted AS "isDeleted" FROM users
   WHERE id=${ids.userId} OR email=${ids.email}`
 const links=await tx<{id:string;userId:string;subject:string;provider:string;isDeleted:boolean}[]>`
   SELECT id,user_id AS "userId",subject,provider,is_deleted AS "isDeleted"
   FROM external_identity_links WHERE id=${ids.linkId}
     OR (provider='supabase' AND subject=${subject}) OR user_id=${ids.userId}`
 const memberships=await tx<{id:string;userId:string;teamId:string;preset:string;isActive:boolean;isDeleted:boolean;effectiveFrom:string;effectiveUntil:string|null}[]>`
   SELECT id,user_id AS "userId",team_id AS "teamId",preset,
    is_active AS "isActive",is_deleted AS "isDeleted",
    effective_from AS "effectiveFrom",effective_until AS "effectiveUntil"
   FROM team_memberships WHERE id=${ids.membershipId} OR user_id=${ids.userId}`
 const state=classifyKan791CoachIdentityState({
  ids,subject,at,users,links,memberships,
 })
 if(state==='complete') return {state:'complete',mutated:false}
 await tx`INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at)
   VALUES (${ids.userId},${ids.userId},${ids.email},'KAN791','Acceptance',${at},${at})`
 await tx`INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at)
   VALUES (${ids.linkId},${ids.userId},'supabase',${subject},${at},${at})`
 await tx`INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at)
   VALUES (${ids.membershipId},${ids.userId},${ids.teamId},'coach',${at},true,${at},${at})`
 return {state:'complete',mutated:true}
}
