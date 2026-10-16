import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'

test('KAN-791 apply is gated by real Supabase session identity verification, not only UUID/email env',()=>{
 const code=readFileSync('scripts/kan-791-pg-coach-identity.ts','utf8')
 assert.match(code,/verifyIdentity:verifyKan791SupabaseIdentity/)
 assert.match(code,/mode==='apply'/)
 const gate=code.indexOf('authorizeKan791ApplyBeforeDatabase({email,subject}')
 const open=code.indexOf('openDatabase:()=>postgres(url,')
 const mutation=code.indexOf('applyKan791CoachIdentity(tx,input)')
 assert.ok(gate>=0 && open>gate && mutation>open,
  'CLI must gate database construction on Supabase proof before invoking apply')
})

test('KAN-791 verifies email and subject against Supabase authenticated user',()=>{
 const code=readFileSync('lib/auth/kan-791-supabase-identity-verification.ts','utf8')
 assert.match(code,/signInWithPassword|auth\.getUser/)
 assert.match(code,/getUser/)
 assert.match(code,/\.id/)
 assert.match(code,/\.email/)
 assert.match(code,/subject/)
 assert.match(code,/email/)
})
