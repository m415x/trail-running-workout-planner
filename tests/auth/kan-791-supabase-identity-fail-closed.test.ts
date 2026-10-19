import assert from 'node:assert/strict'
import test from 'node:test'
import {assertKan791VerifiedSupabaseIdentity} from '@/lib/auth/kan-791-supabase-identity-verification'

const expected={email:'coach-kan-791@test.com',subject:'950eb919-d597-4daa-8ce3-3cc14057465c'}
const valid={id:expected.subject,email:expected.email}

test('KAN-791 dedicated Supabase identity proof accepts exact canonical correspondence',()=>{
 assert.doesNotThrow(()=>assertKan791VerifiedSupabaseIdentity(expected,valid,valid.id))
})
test('KAN-791 identity proof fails closed on altered UID, email or missing provider user',()=>{
 for(const user of [
  {...valid,id:'65375bd2-4a7a-4a00-bf41-d289ec1d54f5'},
  {...valid,email:'coach@test.com'},
  {...valid,email:null},
  null,
 ]) assert.throws(()=>assertKan791VerifiedSupabaseIdentity(expected,user,valid.id),/identity|mismatch|verified/i)
 assert.throws(()=>assertKan791VerifiedSupabaseIdentity(expected,valid,'different-signin-subject'),/identity|mismatch|verified/i)
})
