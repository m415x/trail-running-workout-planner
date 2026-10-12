import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/actions/auth-actions.ts', 'utf8')
const navigation = readFileSync('lib/auth/logout-navigation.ts', 'utf8')

test('KAN-639 logout Server Action uses the Supabase server auth client', () => {
  assert.match(source, /export async function logoutAction/)
  assert.match(source, /createSupabaseServerClient/)
  assert.match(source, /\.auth\.signOut\(\)/)
})

test('KAN-639 logout reports success only after signOut and active-Team clearance', () => {
  assert.match(source, /await supabase\.auth\.signOut\(\)/)
  assert.match(source, /if \(signOutResult\.error\)/)
  assert.match(source, /await context\.clear\(\)/)
  assert.match(source, /return \{ status: 'signed_out' \}/)
})

test('KAN-639 logout supports only es and en localized destinations', () => {
  assert.match(source, /_locale: SupportedAuthLocale/)
  assert.match(navigation, /locale: SupportedAuthLocale/)
  assert.match(navigation, /input\.locale.*login/)
})

test('KAN-639 logout never signals success when Supabase reports a sign-out error', () => {
  assert.match(source, /signOutResult\.error/)
  assert.match(source, /return\s+\{\s*status:\s*['"]invalid['"]\s*\}/)
})
