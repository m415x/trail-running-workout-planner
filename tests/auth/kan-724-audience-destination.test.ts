import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveAudienceDestination } from '@/lib/auth/audience-destination'

const at = '2026-10-11T12:00:00.000Z'

function membership(teamId: string, preset: 'athlete' | 'assistant' | 'coach' | 'admin') {
  return {
    userId: 'user-1',
    teamId,
    preset,
    isActive: true,
    isDeleted: false,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveUntil: null,
  }
}

test('KAN-724/T1 resolves Athlete to Home only from authenticated H2 and effective selected Team preset', () => {
  assert.deepEqual(resolveAudienceDestination({
    access: { status: 'authenticated', userId: 'user-1' },
    team: { status: 'resolved', teamId: 'team-a', source: 'persisted' },
    memberships: [membership('team-a', 'athlete')],
    at,
  }), { status: 'athlete', teamId: 'team-a' })
})

test('KAN-724/T1 resolves Assistant, Coach, and Admin to Coach destination in the validated Team', () => {
  for (const preset of ['assistant', 'coach', 'admin'] as const) {
    assert.deepEqual(resolveAudienceDestination({
      access: { status: 'authenticated', userId: 'user-1' },
      team: { status: 'resolved', teamId: 'team-a', source: 'persisted' },
      memberships: [membership('team-a', preset)],
      at,
    }), { status: 'coach', teamId: 'team-a' })
  }
})

test('KAN-724/T1 preserves selection_required without arbitrarily choosing among Teams', () => {
  assert.deepEqual(resolveAudienceDestination({
    access: { status: 'authenticated', userId: 'user-1' },
    team: { status: 'selection_required' },
    memberships: [membership('team-a', 'athlete'), membership('team-b', 'coach')],
    at,
  }), { status: 'selection_required' })
})

test('KAN-724/T1 denies invalid H2, missing Team context, and mismatched or expired membership', () => {
  const authenticated = { status: 'authenticated' as const, userId: 'user-1' }
  const selected = { status: 'resolved' as const, teamId: 'team-a', source: 'persisted' as const }
  const cases = [
    { access: { status: 'unlinked' as const }, team: selected, memberships: [membership('team-a', 'coach')] },
    { access: authenticated, team: { status: 'invalid_context' as const }, memberships: [membership('team-a', 'coach')] },
    { access: authenticated, team: selected, memberships: [membership('team-b', 'coach')] },
    { access: authenticated, team: selected, memberships: [{ ...membership('team-a', 'coach'), effectiveUntil: '2026-10-01T00:00:00.000Z' }] },
  ]
  for (const input of cases) {
    assert.deepEqual(resolveAudienceDestination({ ...input, at }), { status: 'deny' })
  }
})
