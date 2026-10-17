import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

test('KAN-791 CLI verify uses a database-enforced read-only transaction',()=>{
 const code=readFileSync('scripts/kan-791-pg-coach-identity.ts','utf8')
 assert.match(code,/mode==='verify'/)
 assert.match(code,/SET TRANSACTION READ ONLY/)
 assert.match(code,/inspectKan791CoachIdentity/)
 assert.match(code,/kan791-annual-pg-239-team/)
 assert.match(code,/kan791-annual-pg-239-group/)
 assert.match(code,/kan791-annual-pg-239-plan/)
 assert.doesNotMatch(code,/INSERT INTO|DELETE FROM/)
})

test('KAN-791 CLI target is loopback acceptance PostgreSQL and not a remote Supabase database',()=>{
 const code=readFileSync('scripts/kan-791-pg-coach-identity.ts','utf8')
 const guard=readFileSync('lib/auth/kan-791-provisioner-targets.ts','utf8')
 assert.match(code,/assertKan791LocalDatabaseTargets\(url,process\.env\.SUPABASE_DATABASE_URL\)/)
 assert.match(code,/KAN789_PG_URL/)
 assert.match(guard,/127\.0\.0\.1/)
 assert.match(guard,/55439/)
 assert.match(guard,/kan791_acceptance_v2/)
 assert.match(guard,/assert\.ok\(acceptanceUrl && runtimeUrl/)
})
