import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

test('KAN-854/T0 freezes the unmodified 16.3.8 application baseline', () => {
  const manifest = JSON.parse(read('package.json')) as {
    packageManager: string
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
  }
  assert.equal(manifest.packageManager, 'pnpm@12.4.1')
  assert.equal(manifest.dependencies.next, '16.3.8')
  assert.equal(manifest.devDependencies['eslint-config-next'], '16.3.8')
  assert.equal(manifest.dependencies.zod, '^4.4.3')
})

test('KAN-854/T0 identifies authentic proxy and localized routing boundaries', () => {
  const proxy = read('proxy.ts')
  assert.match(proxy, /createMiddleware\(routing\)/)
  assert.match(proxy, /refreshSupabaseProxySession\(request\)/)
  assert.match(proxy, /carryAuthRefreshIntoResponse\(auth\.response, localizedResponse\)/)
  assert.match(proxy, /matcher:/)
  const config = read('next.config.ts')
  assert.match(config, /withPWAInit/)
  assert.match(config, /disable: process\.env\.NODE_ENV === 'development'/)
  assert.match(config, /withNextIntl\(withPWA\(nextConfig\)\)/)
})

test('KAN-854/T0 rejects accidental transplantation of the historical Next patch', () => {
  const workspace = read('pnpm-workspace.yaml')
  assert.doesNotMatch(workspace, /(?:^|\n)\s*patchedDependencies\s*:/)
  assert.doesNotMatch(workspace, /next@16\.3\.8\s*:\s*patches\//)
  const manifest = read('package.json')
  assert.doesNotMatch(manifest, /"pnpm"\s*:\s*\{[^}]*"patchedDependencies"/s)
})
