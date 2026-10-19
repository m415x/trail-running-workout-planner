export interface Kan791IdentityIds {
  userId:string;linkId:string;membershipId:string;teamId:string;email:string
}
export interface Kan791IdentityStateInput {
  ids:Kan791IdentityIds
  subject:string
  at:string
  users:readonly {id:string;email:string;isDeleted:boolean}[]
  links:readonly {id:string;userId:string;subject:string;provider:string;isDeleted:boolean}[]
  memberships:readonly {
    id:string;userId:string;teamId:string;preset:string;isActive:boolean;
    isDeleted:boolean;effectiveFrom:string;effectiveUntil:string|null
  }[]
}

/** Fail-closed ownership classifier. No mutation and no provider credentials. */
export function classifyKan791CoachIdentityState(input:Kan791IdentityStateInput):'absent'|'complete' {
  const {ids,subject,at,users,links,memberships}=input
  if(users.length===0 && links.length===0 && memberships.length===0) return 'absent'
  const validUser=users.length===1 && users[0]?.id===ids.userId &&
    users[0].email===ids.email && !users[0].isDeleted
  const validLink=links.length===1 && links[0]?.id===ids.linkId &&
    links[0].userId===ids.userId && links[0].subject===subject &&
    links[0].provider==='supabase' && !links[0].isDeleted
  const validMember=memberships.length===1 &&
    memberships[0]?.id===ids.membershipId &&
    memberships[0].userId===ids.userId && memberships[0].teamId===ids.teamId &&
    memberships[0].preset==='coach' && memberships[0].isActive &&
    !memberships[0].isDeleted &&
    memberships[0].effectiveFrom<=at &&
    (memberships[0].effectiveUntil===null || at<memberships[0].effectiveUntil)
  if(!validUser || !validLink || !validMember){
    throw new Error('Identity ownership collision or partial state')
  }
  return 'complete'
}
