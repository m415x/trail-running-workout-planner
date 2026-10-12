import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveAthleteShellAudience } from '@/lib/auth/athlete-shell-audience'

test('KAN-724/T4 redirects effective staff from Athlete shell to localized Dashboard', () => {
  for (const locale of ['es', 'en'] as const) {
    assert.deepEqual(resolveAthleteShellAudience({ status: 'coach', teamId: 'team-a' }, locale), {
      status: 'redirect', location: `/${locale}/dashboard`,
    })
  }
})

test('KAN-724/T4 permits effective Athlete audience', () => {
  assert.deepEqual(resolveAthleteShellAudience({ status: 'athlete', teamId: 'team-a' }, 'es'), { status: 'allow' })
})

test('KAN-724/T4 retains selection_required and deny as fail-closed outcomes', () => {
  for (const audience of [{ status: 'selection_required' }, { status: 'deny' }] as const) {
    assert.deepEqual(resolveAthleteShellAudience(audience, 'en'), { status: 'deny' })
  }
})

test('KAN-724/T4 shared Mobile layout checks server-owned audience before mounting Athlete shell', async () => {
  const { readFile } = await import('node:fs/promises')
  const layout = await readFile('app/[locale]/(mobile)/layout.tsx', 'utf8')
  assert.match(layout, /resolveNextServerAudience\(access\.userId\)/)
  assert.match(layout, /resolveAthleteShellAudience/)
  assert.match(layout, /AudienceAccessUnavailable/)
})
