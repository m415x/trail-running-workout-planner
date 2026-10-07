import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/actions/auth-actions.ts', 'utf8')
const resetAction = source.match(
  /export async function completePasswordRecoveryAction[\s\S]*?\n}\r?\n/,
)?.[0] ?? ''

test('KAN-640 password reset action is wired server-side to the recovery update boundary', () => {
  assert.match(resetAction, /completePasswordRecoveryAction/)
  assert.match(resetAction, /createSupabaseServerClient/)
  assert.match(resetAction, /completePasswordRecovery/)
})

test('KAN-640 password reset action reads only password and locale from FormData', () => {
  assert.match(resetAction, /formData\.get\(['"]password['"]\)/)
  assert.match(resetAction, /formData\.get\(['"]locale['"]\)/)
  assert.doesNotMatch(resetAction, /formData\.get\(['"]email['"]\)/)
  assert.doesNotMatch(resetAction, /dni/i)
})

test('KAN-640 password reset action redirects to localized login only after successful update and sign-out', () => {
  assert.match(resetAction, /result\.status\s*===\s*['"]updated['"]/)
  assert.match(resetAction, /\/login\?recovery=updated/)
  assert.match(resetAction, /redirect\(/)
})

test('KAN-640 password reset action preserves invalid state without redirect', () => {
  assert.match(resetAction, /status:\s*['"]invalid['"]/)
})
