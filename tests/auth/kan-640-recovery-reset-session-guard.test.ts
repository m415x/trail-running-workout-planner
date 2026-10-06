import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/[locale]/auth/recovery/reset/page.tsx', 'utf8')

test('KAN-640 reset page verifies the current Supabase session server-side before rendering', () => {
  assert.match(source, /createSupabaseServerClient/)
  assert.match(source, /readSupabaseServerSessionState/)
  assert.match(source, /session\.status\s*!==\s*['"]verified['"]/)
})

test('KAN-640 reset page fails closed to localized recovery when the session is absent, expired, revoked, or invalid', () => {
  assert.match(source, /redirect\(/)
  assert.match(source, /\/auth\/recovery\?error=recovery_invalid/)
})

test('KAN-640 reset page renders the password form only after verified session state', () => {
  const verificationIndex = source.indexOf('readSupabaseServerSessionState')
  const formIndex = source.indexOf('<RecoveryResetForm')

  assert.ok(verificationIndex >= 0)
  assert.ok(formIndex > verificationIndex)
})

test('KAN-640 reset page does not resolve EPT identity or sports authorization', () => {
  assert.doesNotMatch(source, /ExternalIdentityLink|createExternalIdentityLookup|TeamMembership|capabilit/i)
})
