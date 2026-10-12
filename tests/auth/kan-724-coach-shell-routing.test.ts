import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveCoachShellAudience } from '@/lib/auth/coach-shell-audience'

test('KAN-724/T3 redirects an Athlete from Dashboard to localized Home', () => {
  for (const locale of ['es', 'en'] as const) {
    assert.deepEqual(resolveCoachShellAudience({ status: 'athlete', teamId: 'team-a' }, locale), {
      status: 'redirect', location: `/${locale}`,
    })
  }
})

test('KAN-724/T3 permits a resolved staff audience into the Coach shell', () => {
  assert.deepEqual(resolveCoachShellAudience({ status: 'coach', teamId: 'team-a' }, 'es'), {
    status: 'allow',
  })
})

test('KAN-724/T3 never sends selection_required or denied context into Dashboard or Home', () => {
  for (const audience of [{ status: 'selection_required' }, { status: 'deny' }] as const) {
    assert.deepEqual(resolveCoachShellAudience(audience, 'en'), { status: 'deny' })
  }
})

test('KAN-724/T3 Dashboard layout wires its guard before rendering the shell', async () => {
  const { readFile } = await import('node:fs/promises')
  const layout = await readFile('app/[locale]/dashboard/layout.tsx', 'utf8')
  assert.match(layout, /resolveCoachShellAudience/)
  assert.match(layout, /createActiveTeamNextServerContext|create.*Audience.*NextServer/)
})
