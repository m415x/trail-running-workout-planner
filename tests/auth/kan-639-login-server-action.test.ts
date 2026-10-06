import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/actions/auth-actions.ts', 'utf8')

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
  assert.match(source, /invalid_credentials/)
  assert.match(source, /unlinked/)
  assert.match(source, /invalid/)
  assert.doesNotMatch(source, /redirect\([^\n]*login/i)
})
