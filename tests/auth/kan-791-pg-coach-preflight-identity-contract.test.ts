import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolveKan791AcceptanceIdentity } from '@/lib/auth/kan-791-acceptance-identity'

test('KAN-791 preflight requires dedicated EPT email corresponding to configured Supabase test account',()=>{
 const subject='8c02361c-d027-4ef0-80e0-87d7ad4c3d3b'
 assert.deepEqual(resolveKan791AcceptanceIdentity({
  email:' KAN791-Coach@testing.example ',subject,
 }),{email:'kan791-coach@testing.example',subject})
 for(const email of ['coach@test.com','kan791-coach@acceptance.invalid','someone@example.com','', 'kan791@test.com\nother']){
  assert.throws(()=>resolveKan791AcceptanceIdentity({email,subject}),/dedicated|email|identity/i)
 }
 assert.throws(()=>resolveKan791AcceptanceIdentity({email:'kan791-coach@testing.example',subject:'not-a-uuid'}),/subject|uuid/i)
})

test('KAN-791 preflight CLI reads matching acceptance email without hardcoded placeholder',()=>{
 const code=readFileSync('scripts/kan-791-pg-coach-identity.ts','utf8')
 assert.match(code,/KAN791_AUTH_TEST_EMAIL/)
 assert.match(code,/resolveKan791AcceptanceIdentity/)
 assert.doesNotMatch(code,/const EMAIL='kan791-coach@acceptance\.invalid'/)
 assert.match(code,/inspectKan791CoachIdentity/)
 assert.match(code,/kan791-annual-pg-239-plan/)
})
