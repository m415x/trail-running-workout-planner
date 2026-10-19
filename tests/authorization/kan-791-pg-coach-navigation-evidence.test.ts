import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

test('KAN-791 PG Coach Dashboard navigation selects H4A evidence by server-owned backend',()=>{
  const source=readFileSync('lib/authorization/h4a-next-server-authorization.ts','utf8')
  assert.match(source,/configuredIdentityBackend|createNextServerIdentityEvidence/)
  assert.match(source,/createPostgresH4aEvidenceSource/)
  assert.match(source,/createCoachNavigationServerProjection/)
})

test('KAN-791 PostgreSQL H4A evidence never reads SQLite after backend selection',()=>{
  const source=readFileSync('lib/authorization/h4a-postgres-evidence.ts','utf8')
  assert.match(source,/team_memberships/)
  assert.match(source,/authorization_grants/)
  assert.match(source,/athlete_profiles/)
  assert.doesNotMatch(source,/from ['"]@\/db['"]|createExternalIdentityLookup|catch\s*\{/)
})

test('KAN-791 selected PostgreSQL Dashboard uses one backend for identity audience and H4A navigation',()=>{
  const layout=readFileSync('app/[locale]/dashboard/layout.tsx','utf8')
  assert.match(layout,/createNextServerIdentityEvidence/)
  assert.match(layout,/createCoachNavigationNextServerProjection/)
})
