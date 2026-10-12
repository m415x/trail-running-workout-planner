import assert from 'node:assert/strict'
import test from 'node:test'
import { completeLogoutNavigation } from '@/lib/auth/logout-navigation'

test('KAN-724/T5 navigates to localized Login immediately after successful server logout', async () => {
  for (const locale of ['es', 'en'] as const) {
    const operations: string[] = []
    const result = await completeLogoutNavigation({
      locale,
      signOut: async () => { operations.push('signout'); return { status: 'signed_out' } },
      replace: (path) => operations.push(`replace:${path}`),
      refresh: () => operations.push('refresh'),
    })
    assert.equal(result, 'signed_out')
    assert.deepEqual(operations, ['signout', `replace:/${locale}/login`, 'refresh'])
  }
})

test('KAN-724/T5 logout failure never navigates or claims success', async () => {
  const routes: string[] = []
  const result = await completeLogoutNavigation({
    locale: 'es',
    signOut: async () => ({ status: 'invalid' }),
    replace: (path) => routes.push(path),
    refresh: () => routes.push('refresh'),
  })
  assert.equal(result, 'invalid')
  assert.deepEqual(routes, [])
})

test('KAN-724/T5 Dashboard and denied-audience surfaces use the shared completion path', async () => {
  const { readFile } = await import('node:fs/promises')
  const dashboard = await readFile('app/[locale]/dashboard/DashboardShell.tsx', 'utf8')
  const denied = await readFile('components/auth/AudienceAccessUnavailable.tsx', 'utf8')
  assert.match(dashboard, /completeLogoutNavigation/)
  assert.match(denied, /completeLogoutNavigation/)
})

test('KAN-724/T5 server logout clears active Team after successful Supabase signOut', async () => {
  const { readFile } = await import('node:fs/promises')
  const action = await readFile('app/actions/auth-actions.ts', 'utf8')
  assert.match(action, /supabase\.auth\.signOut\(\)/)
  assert.match(action, /await context\.clear\(\)/)
  assert.match(action, /status: 'signed_out'/)
})
