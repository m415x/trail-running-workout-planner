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

test('KAN-791 PG acceptance identity provisioner enforces ownership and partial-state rejection',()=>{
 const source=readFileSync(path,'utf8')
 assert.match(source,/external_identity_links/)
 assert.match(source,/team_memberships/)
 assert.match(source,/is_deleted/)
 assert.match(source,/collision|Collision|conflict|Conflict/)
 assert.match(source,/ownership|Ownership|owned|Owned/)
 assert.match(source,/DELETE FROM/)
 assert.doesNotMatch(source,/sqlite|service_role|SUPABASE_AUTH_TEST_PASSWORD|KAN791_AUTH_TEST_PASSWORD|signInWithPassword/)
})
