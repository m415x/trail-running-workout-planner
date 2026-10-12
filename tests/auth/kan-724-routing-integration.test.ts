import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveAudienceDestination } from '@/lib/auth/audience-destination'
import { resolveAudienceLoginDestination } from '@/lib/auth/audience-login-routing'
import { resolveCoachShellAudience } from '@/lib/auth/coach-shell-audience'
import { resolveAthleteShellAudience } from '@/lib/auth/athlete-shell-audience'
import { resolveActiveTeamContext } from '@/lib/authorization/active-team-context'

const at = '2026-10-11T12:00:00.000Z'
const make = (teamId: string, preset: 'athlete' | 'coach') => ({
  userId: 'user-1', teamId, preset, isActive: true, isDeleted: false,
  effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null,
})
const classify = (rows: ReturnType<typeof make>[], selected: string | null) => {
  const team = resolveActiveTeamContext({ persistedTeamId: selected, memberships: rows, onDate: at })
  return resolveAudienceDestination({ access: { status: 'authenticated', userId: 'user-1' }, team, memberships: rows, at })
}

test('KAN-724/T7 multi-Team without selection never chooses an audience', () => {
  const audience = classify([make('team-a', 'athlete'), make('team-b', 'coach')], null)
  assert.deepEqual(audience, { status: 'selection_required' })
  assert.deepEqual(resolveCoachShellAudience(audience, 'es'), { status: 'deny' })
  assert.deepEqual(resolveAthleteShellAudience(audience, 'en'), { status: 'deny' })
  assert.equal(resolveAudienceLoginDestination({ audience: audience.status, locale: 'es' }), null)
})

test('KAN-724/T7 switching selected Team recomputes effective destination in both locales', () => {
  const rows = [make('team-a', 'athlete'), make('team-b', 'coach')]
  assert.deepEqual(resolveAthleteShellAudience(classify(rows, 'team-a'), 'es'), { status: 'allow' })
  assert.deepEqual(resolveCoachShellAudience(classify(rows, 'team-a'), 'en'), { status: 'redirect', location: '/en' })
  assert.deepEqual(resolveCoachShellAudience(classify(rows, 'team-b'), 'es'), { status: 'allow' })
  assert.deepEqual(resolveAthleteShellAudience(classify(rows, 'team-b'), 'en'), { status: 'redirect', location: '/en/dashboard' })
})

test('KAN-724/T7 expired or revoked selection fails closed even with another valid Team', () => {
  const rows = [{ ...make('team-a', 'athlete'), isActive: false }, make('team-b', 'coach')]
  assert.deepEqual(classify(rows, 'team-a'), { status: 'deny' })
  assert.deepEqual(classify(rows, 'team-b'), { status: 'coach', teamId: 'team-b' })
})

test('KAN-724/T7 effective audience respects preset changes without stale redirects', () => {
  const before = classify([make('team-a', 'athlete')], 'team-a')
  const after = classify([make('team-a', 'coach')], 'team-a')
  assert.equal(resolveAudienceLoginDestination({ audience: before.status, locale: 'es', returnTo: '/es/dashboard' }), '/es')
  assert.equal(resolveAudienceLoginDestination({ audience: after.status, locale: 'es', returnTo: '/es/dashboard' }), '/es/dashboard')
})

test('KAN-724/T7 duplicate effective memberships do not silently choose a preset', () => {
  assert.deepEqual(classify([make('team-a', 'athlete'), make('team-a', 'coach')], 'team-a'), { status: 'deny' })
})

test('KAN-724/T7 real login action resolves audience before choosing post-login destination', async () => {
  const { readFile } = await import('node:fs/promises')
  const action = await readFile('app/actions/auth-actions.ts', 'utf8')
  assert.match(action, /resolveNextServerAudience\(result\.userId\)/)
  assert.match(action, /resolveAudienceLoginDestination/)
})
