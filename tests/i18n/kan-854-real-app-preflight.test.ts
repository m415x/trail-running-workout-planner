import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

type RealAppPreflight = { ok: boolean; blockers: string[]; routing: { locales: string[]; defaultLocale: string; prefix: string } }

export function inspectRealAppHttpPrerequisites(input: {
  routingSource: string
  proxySource: string
  nextConfigSource: string
  env: Record<string, string | undefined>
}): RealAppPreflight {
  const blockers: string[] = []
  const { routingSource, proxySource, nextConfigSource, env } = input
  const localeMatches = routingSource.match(/locales:\s*\[([^\]]+)\]/)
  const locales = localeMatches ? [...localeMatches[1].matchAll(/['"]([a-z]{2})['"]/g)].map(m => m[1]) : []
  const defaultLocale = routingSource.match(/defaultLocale:\s*['"]([^'"]+)['"]/)?.[1] ?? ''
  const prefix = routingSource.match(/localePrefix:\s*['"]([^'"]+)['"]/)?.[1] ?? ''
  if (locales.join(',') !== 'es,en' || defaultLocale !== 'es' || prefix !== 'as-needed') blockers.push('Unexpected real-app i18n routing contract')
  if (!proxySource.includes('refreshSupabaseProxySession(request)') || !proxySource.includes('carryAuthRefreshIntoResponse(auth.response, localizedResponse)')) blockers.push('Expected real proxy/refresh boundary missing')
  if (!nextConfigSource.includes('withNextIntl(withPWA(nextConfig))')) blockers.push('Real Next config unexpectedly changed')
  if (env.NODE_ENV === 'production') blockers.push('Do not run this disposable acceptance in production')
  if (env.CI === 'true') blockers.push('Do not run authenticated disposable acceptance in CI without separately approved fixture')
  if (env.SQLITE_DATABASE_PATH && !/(?:^|[\\/])kan-854-(?:disposable|acceptance)-/.test(env.SQLITE_DATABASE_PATH)) blockers.push('SQLite database not identified as disposable KAN-854 fixture')
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) blockers.push('Local Supabase configuration unavailable: authenticated HTTP is not prepared')
  return { ok: blockers.length === 0, blockers, routing: { locales, defaultLocale, prefix } }
}

test('KAN-854/T1 identifies authentic locale and proxy contract without starting server', () => {
  const result = inspectRealAppHttpPrerequisites({
    routingSource: readFileSync('i18n/routing.ts', 'utf8'),
    proxySource: readFileSync('proxy.ts', 'utf8'),
    nextConfigSource: readFileSync('next.config.ts', 'utf8'),
    env: { NODE_ENV: 'development', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-placeholder', SQLITE_DATABASE_PATH: 'C:/temp/kan-854-disposable-1/sqlite.db' },
  })
  assert.deepEqual(result.routing, { locales: ['es', 'en'], defaultLocale: 'es', prefix: 'as-needed' })
  assert.deepEqual(result.blockers, [])
})

test('KAN-854/T1 fails closed on missing auth and non-disposable SQLite', () => {
  const result = inspectRealAppHttpPrerequisites({
    routingSource: readFileSync('i18n/routing.ts', 'utf8'),
    proxySource: readFileSync('proxy.ts', 'utf8'),
    nextConfigSource: readFileSync('next.config.ts', 'utf8'),
    env: { SQLITE_DATABASE_PATH: 'sqlite.db' },
  })
  assert.equal(result.ok, false)
  assert.ok(result.blockers.some(x => x.includes('SQLite')))
  assert.ok(result.blockers.some(x => x.includes('Supabase')))
})
