import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts?: Record<string, string>
}
const source = readFileSync('scripts/verify-supabase-auth-session.ts', 'utf8')

test('KAN-638 exposes a dedicated real Supabase Auth verification command', () => {
  assert.equal(
    packageJson.scripts?.['auth:supabase:verify'],
    'tsx scripts/verify-supabase-auth-session.ts',
  )
})

test('KAN-638 real verifier requires explicit test credentials instead of fabricating users', () => {
  assert.match(source, /SUPABASE_AUTH_TEST_EMAIL/)
  assert.match(source, /SUPABASE_AUTH_TEST_PASSWORD/)
  assert.match(source, /NEXT_PUBLIC_SUPABASE_URL/)
  assert.match(source, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/)
  assert.doesNotMatch(source, /signUp\(/)
  assert.doesNotMatch(source, /admin\./)
})

test('KAN-638 real verifier exercises Supabase Auth without mocks', () => {
  assert.match(source, /createClient/)
  assert.match(source, /signInWithPassword/)
  assert.match(source, /getClaims\(\)/)
  assert.match(source, /getUser\(\)/)
  assert.match(source, /signOut\(/)
  assert.doesNotMatch(source, /mock|fixture|fake/i)
})

test('KAN-638 real verifier fails if claims and Auth user subjects disagree', () => {
  assert.match(source, /claims\.sub/)
  assert.match(source, /user\.id/)
  assert.match(source, /!==/)
  assert.match(source, /process\.exitCode\s*=\s*1/)
})

test('KAN-642 real verifier loads .env.local explicitly before reading Auth variables', () => {
  assert.match(source, /dotenv/)
  assert.match(source, /\.env\.local/)
  assert.match(source, /config\(/)
})
