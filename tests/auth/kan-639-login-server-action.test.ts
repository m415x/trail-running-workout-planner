import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/actions/auth-actions.ts', 'utf8')

function actionBody(name: string): string {
  const start = source.indexOf(`export async function ${name}`)
  assert.ok(start >= 0, `missing ${name}`)
  const next = source.indexOf('\nexport async function ', start + 1)
  return next === -1 ? source.slice(start) : source.slice(start, next)
}

test('KAN-639 login Server Action is a server-only boundary wired to Supabase and EPT identity lookup', () => {
  assert.match(source, /^['"]use server['"]/)
  assert.match(source, /createSupabaseServerClient/)
  assert.match(source, /createExternalIdentityLookup/)
  assert.match(source, /authenticateEptLogin/)
})

test('KAN-639 login Server Action reads only the approved login fields from FormData', () => {
  for (const field of ['email', 'password', 'locale', 'returnTo']) {
    assert.match(source, new RegExp(`formData\\.get\\(['"]${field}['"]\\)`))
  }

  assert.doesNotMatch(source, /dni/i)
  assert.doesNotMatch(source, /TeamMembership|capabilit|permission/i)
})

test('KAN-639 login Server Action redirects only after authenticated EPT identity resolution', () => {
  assert.match(source, /result\.status\s*===\s*['"]authenticated['"]/)
  assert.match(source, /redirect\(result\.returnTo\)/)
})

test('KAN-639 login Server Action preserves explicit non-authenticated outcomes for localized UI', () => {
  const login = actionBody('loginAction')
  assert.match(login, /invalid_credentials/)
  assert.match(login, /unlinked/)
  assert.match(login, /invalid/)
  assert.doesNotMatch(login, /redirect\([^\n]*login/i)
})
