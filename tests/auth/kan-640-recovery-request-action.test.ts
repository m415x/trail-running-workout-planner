import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/actions/auth-actions.ts', 'utf8')
const recoveryAction = source.match(
  /export async function requestPasswordRecoveryAction[\s\S]*?\n}\r?\n/,
)?.[0] ?? ''

test('KAN-640 recovery request action is wired server-side to Supabase recovery', () => {
  assert.match(recoveryAction, /requestPasswordRecoveryAction/)
  assert.match(recoveryAction, /createSupabaseServerClient/)
  assert.match(recoveryAction, /requestPasswordRecovery/)
})

test('KAN-640 recovery request action derives origin from request headers, not FormData', () => {
  assert.match(source, /import \{ headers \} from ['"]next\/headers['"]/)
  assert.match(recoveryAction, /headers/)
  assert.match(recoveryAction, /get\(['"]origin['"]\)/)
  assert.doesNotMatch(recoveryAction, /formData\.get\(['"]origin['"]\)/)
})

test('KAN-640 recovery request action reads only email and locale from FormData', () => {
  assert.match(recoveryAction, /formData\.get\(['"]email['"]\)/)
  assert.match(recoveryAction, /formData\.get\(['"]locale['"]\)/)
  assert.doesNotMatch(recoveryAction, /formData\.get\(['"]password['"]\)/)
  assert.doesNotMatch(recoveryAction, /dni/i)
})

test('KAN-640 recovery request action preserves a non-enumerative public state', () => {
  assert.match(recoveryAction, /status:\s*['"]accepted['"]/)
  assert.match(recoveryAction, /status:\s*['"]error['"]/)
  assert.doesNotMatch(recoveryAction, /not_found|unknown_email|user_exists|account_exists/i)
})
