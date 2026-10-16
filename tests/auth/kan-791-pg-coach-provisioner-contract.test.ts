import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

const path='scripts/kan-791-pg-coach-identity.ts'

test('KAN-791 PG acceptance identity provisioner exposes explicit safe modes and subject input',()=>{
 const source=readFileSync(path,'utf8')
 assert.match(source,/verify|apply|cleanup/)
 assert.match(source,/KAN791_AUTH_SUBJECT/)
 assert.match(source,/kan789_acceptance/)
 assert.match(source,/127\.0\.0\.1/)
 assert.match(source,/55439/)
 assert.match(source,/kan791-annual-pg-239-team/)
 assert.match(source,/await sql\.begin\(async/)
})

test('KAN-791 PG acceptance identity provisioner delegates ownership and partial-state rejection',()=>{
 const cli=readFileSync(path,'utf8')
 const inspect=readFileSync('lib/auth/kan-791-provisioner-lifecycle.ts','utf8')
 const apply=readFileSync('lib/auth/kan-791-provisioner-transaction.ts','utf8')
 const state=readFileSync('lib/auth/kan-791-provisioner-state.ts','utf8')
 assert.match(cli,/inspectKan791CoachIdentity/)
 assert.match(cli,/applyKan791CoachIdentity/)
 assert.match(cli,/cleanupKan791CoachIdentity/)
 assert.doesNotMatch(cli,/INSERT INTO|DELETE FROM|classifyKan791CoachIdentityState/)
 assert.match(inspect,/external_identity_links/)
 assert.match(inspect,/team_memberships/)
 assert.match(inspect,/is_deleted/)
 assert.match(inspect,/DELETE FROM/)
 assert.match(apply,/external_identity_links/)
 assert.match(apply,/team_memberships/)
 assert.match(state,/collision|Collision|conflict|Conflict/)
 assert.match(state,/ownership|Ownership|owned|Owned/)
 for(const source of [cli,inspect,apply,state]){
  assert.doesNotMatch(source,/sqlite|service_role|SUPABASE_AUTH_TEST_PASSWORD|KAN791_AUTH_TEST_PASSWORD|signInWithPassword/)
 }
})
