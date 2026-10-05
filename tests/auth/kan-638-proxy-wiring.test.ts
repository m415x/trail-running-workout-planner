import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  dependencies?: Record<string, string>
}
const envExample = readFileSync('.env.example', 'utf8')
const proxySource = readFileSync('proxy.ts', 'utf8')
const authProxySource = readFileSync('lib/auth/supabase-proxy.ts', 'utf8')

test('KAN-638 declares the supported Supabase SSR runtime dependencies', () => {
  assert.match(packageJson.dependencies?.['@supabase/ssr'] ?? '', /^\^?0\.12\./)
  assert.match(packageJson.dependencies?.['@supabase/supabase-js'] ?? '', /^\^?2\./)
})

test('KAN-638 documents the public Supabase Auth project configuration without service credentials', () => {
  assert.match(envExample, /^NEXT_PUBLIC_SUPABASE_URL=/m)
  assert.match(envExample, /^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=/m)
  assert.doesNotMatch(envExample, /SUPABASE_SERVICE_ROLE/i)
})

test('KAN-638 builds the proxy auth client with createServerClient and the approved public configuration', () => {
  assert.match(authProxySource, /from ['"]@supabase\/ssr['"]/)
  assert.match(authProxySource, /createServerClient/)
  assert.match(authProxySource, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/)
  assert.match(authProxySource, /process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/)
  assert.match(authProxySource, /getClaims\(\)/)
  assert.doesNotMatch(authProxySource, /getSession\(\)/)
})

test('KAN-638 composes auth refresh with the existing next-intl proxy instead of replacing localization', () => {
  assert.match(proxySource, /createMiddleware\(routing\)/)
  assert.match(proxySource, /refreshSupabaseProxySession/)
  assert.match(proxySource, /carryAuthRefreshIntoResponse/)
  assert.match(proxySource, /export\s+async\s+function\s+proxy\s*\(/)
})

test('KAN-638 keeps the existing matcher exclusions while adding auth refresh', () => {
  assert.match(proxySource, /api\|trpc\|_next\|_vercel/)
})
