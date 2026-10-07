import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/[locale]/auth/recovery/callback/route.ts', 'utf8')

test('KAN-640 recovery callback exchanges the PKCE code server-side', () => {
  assert.match(source, /createSupabaseServerClient/)
  assert.match(source, /exchangePasswordRecoveryCode/)
  assert.match(source, /searchParams\.get\(['"]code['"]\)/)
})

test('KAN-640 recovery callback redirects verified sessions to the localized reset form', () => {
  assert.match(source, /result\.status\s*===\s*['"]verified['"]/)
  assert.match(source, /\/auth\/recovery\/reset/)
  assert.match(source, /locale/)
})

test('KAN-640 recovery callback sends invalid, expired, or replayed codes back to localized recovery', () => {
  assert.match(source, /\/auth\/recovery/)
  assert.match(source, /error=recovery_invalid/)
})

test('KAN-640 recovery callback does not resolve EPT identity or grant sports access', () => {
  assert.doesNotMatch(source, /ExternalIdentityLink|createExternalIdentityLookup|TeamMembership|capabilit/i)
})
