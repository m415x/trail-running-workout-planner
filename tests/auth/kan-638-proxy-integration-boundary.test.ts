import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const proxySource = readFileSync('proxy.ts', 'utf8')
const authProxySource = readFileSync('lib/auth/supabase-proxy.ts', 'utf8')
const coreSource = readFileSync('lib/auth/supabase-proxy-core.ts', 'utf8')

test('KAN-638 keeps localization as the terminal response path regardless of auth verification result', () => {
  assert.match(proxySource, /const\s+auth\s*=\s*await\s+refreshSupabaseProxySession\(request\)/)
  assert.match(proxySource, /const\s+localizedResponse\s*=\s*intlMiddleware\(request\)/)
  assert.match(proxySource, /carryAuthRefreshIntoResponse\(auth\.response,\s*localizedResponse\)/)
})

test('KAN-638 does not add route redirects or authorization decisions in the session refresh layer', () => {
  assert.doesNotMatch(proxySource, /redirect\(/)
  assert.doesNotMatch(authProxySource, /redirect\(/)
  assert.doesNotMatch(coreSource, /TeamMembership|capabilit|permission|authorize/i)
})

test('KAN-638 treats unverifiable sessions as invalid without throwing or redirecting', () => {
  assert.match(coreSource, /return \{ status: 'invalid', cookies: \[\] \}/)
  assert.match(authProxySource, /status:\s*result\.status/)
  assert.doesNotMatch(authProxySource, /throw\s+new\s+Error/)
})

test('KAN-638 keeps the existing locale matcher contract intact', () => {
  assert.match(proxySource, /matcher:\s*'\/\(\(\?!api\|trpc\|_next\|_vercel\|\.\*\\\\\.\.\*\)\.\*\)'/)
})
