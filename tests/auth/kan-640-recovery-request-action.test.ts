import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/actions/auth-actions.ts', 'utf8')

test('KAN-640 recovery request action is wired server-side to Supabase recovery', () => {
  assert.match(source, /export async function requestPasswordRecoveryAction/)
  assert.match(source, /createSupabaseServerClient/)
  assert.match(source, /requestPasswordRecovery/)
})

test('KAN-640 recovery request action derives origin from request headers, not FormData', () => {
  assert.match(source, /headers/)
  assert.match(source, /get\(['"]origin['"]\)/)
  assert.doesNotMatch(source, /formData\.get\(['"]origin['"]\)/)
})

test('KAN-640 recovery request action reads only email and locale from FormData', () => {
  assert.match(source, /formData\.get\(['"]email['"]\)/)
  assert.match(source, /formData\.get\(['"]locale['"]\)/)
  assert.doesNotMatch(source, /formData\.get\(['"]password['"]\)/)
  assert.doesNotMatch(source, /dni/i)
})

test('KAN-640 recovery request action preserves a non-enumerative public state', () => {
  assert.match(source, /status:\s*['"]accepted['"]/)
  assert.match(source, /status:\s*['"]error['"]/)
  assert.doesNotMatch(source, /not_found|unknown_email|user_exists|account_exists/i)
})
