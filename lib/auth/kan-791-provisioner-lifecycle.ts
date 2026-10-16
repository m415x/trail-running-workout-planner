import type { TransactionSql } from 'postgres'
import {classifyKan791CoachIdentityState,type Kan791IdentityIds} from './kan-791-provisioner-state'

type Tx=TransactionSql
export interface Kan791LifecycleInput {
 ids:Kan791IdentityIds;subject:string;at:string
}
export async function inspectKan791CoachIdentity(tx:Tx,input:Kan791LifecycleInput):Promise<'absent'|'complete'> {
 const {ids,subject,at}=input
 const users=await tx<{id:string;email:string;isDeleted:boolean}[]>`
  SELECT id,email,is_deleted AS "isDeleted" FROM users WHERE id=${ids.userId} OR email=${ids.email}`
 const links=await tx<{id:string;userId:string;subject:string;provider:string;isDeleted:boolean}[]>`
  SELECT id,user_id AS "userId",subject,provider,is_deleted AS "isDeleted"
  FROM external_identity_links WHERE id=${ids.linkId}
   OR (provider='supabase' AND subject=${subject}) OR user_id=${ids.userId}`
 const memberships=await tx<{id:string;userId:string;teamId:string;preset:string;isActive:boolean;isDeleted:boolean;effectiveFrom:string;effectiveUntil:string|null}[]>`
  SELECT id,user_id AS "userId",team_id AS "teamId",preset,
    is_active AS "isActive",is_deleted AS "isDeleted",
    effective_from AS "effectiveFrom",effective_until AS "effectiveUntil"
  FROM team_memberships WHERE id=${ids.membershipId} OR user_id=${ids.userId}`
 return classifyKan791CoachIdentityState({ids,subject,at,users,links,memberships})
}
export async function cleanupKan791CoachIdentity(tx:Tx,input:Kan791LifecycleInput):
 Promise<{state:'absent';mutated:boolean}> {
 const state=await inspectKan791CoachIdentity(tx,input)
 if(state==='absent')return {state:'absent',mutated:false}
 const {ids,subject}=input
 const members=await tx`DELETE FROM team_memberships
  WHERE id=${ids.membershipId} AND user_id=${ids.userId}
   AND team_id=${ids.teamId} AND preset='coach' RETURNING id`
 if(members.length!==1)throw new Error('Membership ownership mismatch')
 const links=await tx`DELETE FROM external_identity_links
  WHERE id=${ids.linkId} AND user_id=${ids.userId}
   AND provider='supabase' AND subject=${subject} RETURNING id`
 if(links.length!==1)throw new Error('Link ownership mismatch')
 const users=await tx`DELETE FROM users
  WHERE id=${ids.userId} AND email=${ids.email} RETURNING id`
 if(users.length!==1)throw new Error('User ownership mismatch')
 return {state:'absent',mutated:true}
}
