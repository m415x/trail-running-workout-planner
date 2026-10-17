import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {resolveIdentityBackend} from '@/lib/auth/identity-backend-selection'

test('KAN-791 T6-D identity backend is resolved only by server configuration, never client data',()=>{
  assert.equal(resolveIdentityBackend(undefined),'sqlite')
  assert.equal(resolveIdentityBackend('sqlite'),'sqlite')
  assert.equal(resolveIdentityBackend('postgres'),'postgres')
  assert.throws(()=>resolveIdentityBackend('invalid'),/backend/i)
})

test('KAN-791 T6-D login, existing-session and dashboard share selected backend authority',()=>{
  const login=readFileSync('app/actions/auth-actions.ts','utf8')
  const page=readFileSync('app/[locale]/login/page.tsx','utf8')
  const dashboard=readFileSync('app/[locale]/dashboard/layout.tsx','utf8')
  const lookup=readFileSync('lib/auth/external-identity-lookup.ts','utf8')
  const audience=readFileSync('lib/auth/next-server-audience.ts','utf8')
  const team=readFileSync('lib/authorization/active-team-next-server.ts','utf8')
  const navigation=readFileSync('lib/authorization/h4a-next-server-authorization.ts','utf8')
  for(const code of [login,page,dashboard]) {
    assert.match(code,/createNextServerIdentityEvidence/)
    assert.doesNotMatch(code,/createExternalIdentityLookup\(\)/)
  }
  assert.match(lookup,/createExternalIdentityLookup/)
  for(const code of [audience,team,navigation])
    assert.match(code,/identity-backend|IdentityBackend|identityBackend|createNextServerIdentityEvidence/,
      'Selected backend must propagate through the server identity boundary')
})

test('KAN-791 T6-D must preserve shared H2 and H3/H4A pure contracts',()=>{
  const login=readFileSync('lib/auth/login-flow.ts','utf8')
  const context=readFileSync('lib/authorization/active-team-context.ts','utf8')
  const audience=readFileSync('lib/auth/audience-destination.ts','utf8')
  assert.match(login,/readSupabaseServerSessionState/)
  assert.match(context,/resolveActiveTeamContext/)
  assert.match(audience,/resolveAudienceDestination/)
})
