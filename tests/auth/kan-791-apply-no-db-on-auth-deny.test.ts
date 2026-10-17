import assert from 'node:assert/strict'
import test from 'node:test'
import {authorizeKan791ApplyBeforeDatabase} from '@/lib/auth/kan-791-apply-preflight'

const identity={email:'coach-kan-791@test.com',subject:'950eb919-d597-4daa-8ce3-3cc14057465c'}

test('KAN-791 apply authentication rejection prevents opening any PostgreSQL connection',async()=>{
 let connections=0
 let verifications=0
 await assert.rejects(
  authorizeKan791ApplyBeforeDatabase(identity,{
   verifyIdentity:async()=>{verifications++;throw new Error('Dedicated Supabase authentication failed')},
   openDatabase:()=>{connections++;return {ready:true}},
  }),/authentication failed/,
 )
 assert.equal(verifications,1)
 assert.equal(connections,0)
})

test('KAN-791 apply does not open PostgreSQL when authenticated UID/email mismatch',async()=>{
 let connections=0
 await assert.rejects(authorizeKan791ApplyBeforeDatabase(identity,{
  verifyIdentity:async()=>{throw new Error('Dedicated Supabase identity mismatch')},
  openDatabase:()=>{connections++;return {ready:true}},
 }),/identity mismatch/)
 assert.equal(connections,0)
})

test('KAN-791 apply opens PostgreSQL exactly once only after successful identity proof',async()=>{
 const order:string[]=[]
 const result=await authorizeKan791ApplyBeforeDatabase(identity,{
  verifyIdentity:async()=>{order.push('auth')},
  openDatabase:()=>{order.push('db');return {ready:true}},
 })
 assert.deepEqual(order,['auth','db'])
 assert.deepEqual(result,{ready:true})
})
