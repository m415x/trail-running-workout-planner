import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyKan791CoachIdentityState,
} from '@/lib/auth/kan-791-provisioner-state'

const subject='11111111-2222-4333-8444-555555555555'
const ids={
  userId:'kan791-pg-coach-identity-user',
  linkId:'kan791-pg-coach-identity-link',
  membershipId:'kan791-pg-coach-identity-membership',
  teamId:'kan791-annual-pg-239-team',
  email:'kan791-coach@acceptance.invalid',
}
const user={id:ids.userId,email:ids.email,isDeleted:false}
const link={id:ids.linkId,userId:ids.userId,subject,provider:'supabase',isDeleted:false}
const membership={id:ids.membershipId,userId:ids.userId,teamId:ids.teamId,preset:'coach',isActive:true,isDeleted:false,effectiveFrom:'2026-01-01T00:00:00.000Z',effectiveUntil:null}

test('KAN-791 P2 empty and exclusively owned complete identity are distinguished',()=>{
  assert.equal(classifyKan791CoachIdentityState({ids,subject,users:[],links:[],memberships:[],at:'2026-10-16T00:00:00.000Z'}),'absent')
  assert.equal(classifyKan791CoachIdentityState({ids,subject,users:[user],links:[link],memberships:[membership],at:'2026-10-16T00:00:00.000Z'}),'complete')
})

test('KAN-791 P2 rejects foreign subject collisions and partial ownership',()=>{
  const input={ids,subject,users:[user],links:[link],memberships:[membership],at:'2026-10-16T00:00:00.000Z'}
  assert.throws(()=>classifyKan791CoachIdentityState({...input,links:[{...link,id:'foreign-link',userId:'foreign-user'}]}),/collision|partial|ownership/i)
  assert.throws(()=>classifyKan791CoachIdentityState({...input,memberships:[]}),/collision|partial|ownership/i)
  assert.throws(()=>classifyKan791CoachIdentityState({...input,links:[{...link,subject:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'}]}),/collision|partial|ownership/i)
  assert.throws(()=>classifyKan791CoachIdentityState({...input,memberships:[{...membership,teamId:'foreign-team'}]}),/collision|partial|ownership/i)
  assert.throws(()=>classifyKan791CoachIdentityState({...input,memberships:[{...membership,isActive:false}]}),/collision|partial|ownership/i)
  assert.throws(()=>classifyKan791CoachIdentityState({...input,memberships:[{...membership,effectiveFrom:'2099-01-01T00:00:00.000Z'}]}),/collision|partial|ownership/i)
})
