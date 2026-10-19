import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'

test('KAN-791 selected PG backend is reused by login, existing-session and dashboard identity resolution',()=>{
  const source=readFileSync('lib/auth/identity-backend-next-server.ts','utf8')
  assert.match(source,/configuredIdentityBackend/)
  assert.match(source,/createPostgresIdentityEvidence/)
  assert.doesNotMatch(source,/catch\s*\{/)
  for(const path of [
    'app/actions/auth-actions.ts',
    'app/[locale]/login/page.tsx',
    'app/[locale]/dashboard/layout.tsx',
  ]){
    const code=readFileSync(path,'utf8')
    assert.match(code,/createNextServerIdentityEvidence\(\)\.lookup/)
    assert.doesNotMatch(code,/createExternalIdentityLookup\(\)/)
  }
})

test('KAN-791 Team selection and audience both load memberships through selected backend',()=>{
  const team=readFileSync('lib/authorization/active-team-next-server.ts','utf8')
  const audience=readFileSync('lib/auth/next-server-audience.ts','utf8')
  assert.match(team,/identityBackend\.memberships\.loadMemberships\(userId\)/)
  assert.match(audience,/identityBackend\.memberships\.loadMemberships\(userId\)/)
})
