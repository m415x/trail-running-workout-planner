import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

test('KAN-791 P5 CLI delegates verify, apply and cleanup to shared ownership services',()=>{
 const source=readFileSync('scripts/kan-791-pg-coach-identity.ts','utf8')
 assert.match(source,/inspectKan791CoachIdentity/)
 assert.match(source,/applyKan791CoachIdentity/)
 assert.match(source,/cleanupKan791CoachIdentity/)
 assert.match(source,/await sql\.begin\(async/)
 assert.doesNotMatch(source,/DELETE FROM (?:users|external_identity_links|team_memberships)/)
 assert.doesNotMatch(source,/INSERT INTO (?:users|external_identity_links|team_memberships)/)
 assert.doesNotMatch(source,/classifyKan791CoachIdentityState/)
 assert.match(source,/kan791-annual-pg-239-plan/)
 assert.match(source,/kan791-annual-pg-239-group/)
})
