import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveExistingSessionLogin } from '@/lib/auth/existing-session-login'

test('KAN-724/T6 redirects effective authenticated Athlete and staff without relogin', () => {
  assert.deepEqual(resolveExistingSessionLogin({ session: { status: 'authenticated', userId: 'user-1' }, audience: { status: 'athlete', teamId: 'team-a' }, locale: 'es', returnTo: '/es/plan' }), { status: 'redirect', location: '/es/plan' })
  assert.deepEqual(resolveExistingSessionLogin({ session: { status: 'authenticated', userId: 'user-2' }, audience: { status: 'coach', teamId: 'team-b' }, locale: 'en', returnTo: '/en/profile' }), { status: 'redirect', location: '/en/dashboard' })
})

test('KAN-724/T6 does not redirect anonymous, invalid or unlinked session into protected shells', () => {
  for (const status of ['anonymous', 'invalid', 'unlinked'] as const) {
    assert.deepEqual(resolveExistingSessionLogin({ session: { status }, audience: { status: 'deny' }, locale: 'es' }), { status: 'show_login' })
  }
})

test('KAN-724/T6 handles unresolved multi-Team without redirect loops', () => {
  assert.deepEqual(resolveExistingSessionLogin({ session: { status: 'authenticated', userId: 'user-1' }, audience: { status: 'selection_required' }, locale: 'en' }), { status: 'access_unavailable' })
})

test('KAN-724/T6 Login page uses current EPT session and server-side audience routing', async () => {
  const { readFile } = await import('node:fs/promises')
  const page = await readFile('app/[locale]/login/page.tsx', 'utf8')
  assert.match(page, /readEptSessionAccessState/)
  assert.match(page, /resolveNextServerAudience/)
  assert.match(page, /resolveExistingSessionLogin/)
})
