import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/actions/auth-actions.ts', 'utf8')

test('KAN-639 logout Server Action uses the Supabase server auth client', () => {
  assert.match(source, /export async function logoutAction/)
  assert.match(source, /createSupabaseServerClient/)
  assert.match(source, /\.auth\.signOut\(\)/)
})

test('KAN-639 logout redirects to the localized login route only after successful sign out', () => {
  assert.match(source, /logoutAction[\s\S]*locale/)
  assert.match(source, /signOut\(\)[\s\S]*redirect\(/)
  assert.match(source, /\/login/)
})

test('KAN-639 logout supports only es and en localized destinations', () => {
  assert.match(source, /locale\s*===\s*['"]en['"]/)
  assert.match(source, /['"]\/en\/login['"]/)
  assert.match(source, /['"]\/es\/login['"]/)
})

test('KAN-639 logout does not redirect when Supabase reports a sign-out error', () => {
  assert.match(source, /signOutResult\.error/)
  assert.match(source, /return\s+\{\s*status:\s*['"]invalid['"]\s*\}/)
})
