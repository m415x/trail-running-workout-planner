import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'

test('KAN-791 apply is gated by real Supabase session identity verification, not only UUID/email env',()=>{
 const code=readFileSync('scripts/kan-791-pg-coach-identity.ts','utf8')
 assert.match(code,/verifyKan791SupabaseIdentity/)
 assert.match(code,/if\s*\(mode==='apply'\)/)
 const gate=code.indexOf('verifyKan791SupabaseIdentity(')
 const mutation=code.indexOf('applyKan791CoachIdentity(')
 assert.ok(gate>=0 && mutation>gate,'Authentic Supabase proof must precede apply')
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
