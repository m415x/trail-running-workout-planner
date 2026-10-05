import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync('lib/auth/supabase-proxy.ts', 'utf8')

test('KAN-638 real Next proxy adapter delegates auth verification to the fail-closed core', () => {
  assert.match(
    source,
    /createSupabaseProxySessionRefresher/,
    'real adapter must consume the tested fail-closed core',
  )
  assert.match(
    source,
    /NEXT_PUBLIC_SUPABASE_URL/,
    'real adapter must provide runtime URL through the core config boundary',
  )
  assert.match(
    source,
    /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    'real adapter must provide runtime publishable key through the core config boundary',
  )
})

test('KAN-638 real Next proxy adapter does not duplicate claims verification outside the core', () => {
  assert.doesNotMatch(
    source,
    /auth\.getClaims\(\)/,
    'claims verification belongs to supabase-proxy-core',
  )
})

test('KAN-638 real Next proxy adapter still materializes rotated cookies on the response', () => {
  assert.match(source, /response\.cookies\.set/)
  assert.match(source, /Cache-Control/)
  assert.match(source, /private, no-store/)
})
