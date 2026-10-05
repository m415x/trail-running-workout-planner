import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync('lib/auth/supabase-server.ts', 'utf8')

test('KAN-638 server auth factory uses Next.js cookies and Supabase createServerClient', () => {
  assert.match(source, /from ['"]next\/headers['"]/)
  assert.match(source, /from ['"]@supabase\/ssr['"]/)
  assert.match(source, /await\s+cookies\(\)/)
  assert.match(source, /createServerClient/)
})

test('KAN-638 server auth factory exposes all incoming cookies and attempts setAll for writable server contexts', () => {
  assert.match(source, /getAll\(\)/)
  assert.match(source, /setAll/)
  assert.match(source, /cookieStore\.set/)
})

test('KAN-638 server auth factory tolerates read-only cookie stores used by Server Components', () => {
  assert.match(
    source,
    /try\s*\{[\s\S]*cookieStore\.set[\s\S]*\}\s*catch\s*\{/,
    'read-only Server Component cookie writes must not crash auth reads',
  )
})

test('KAN-638 server auth factory refuses incomplete public Supabase configuration', () => {
  assert.match(source, /NEXT_PUBLIC_SUPABASE_URL/)
  assert.match(source, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/)
  assert.match(source, /if\s*\(.*!url.*\|\|.*!publishableKey/s)
})
