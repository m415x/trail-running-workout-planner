import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { resolveActiveTeamContext } from '@/lib/authorization/active-team-context'
import { createH6EconomicAuthorizationBoundary } from '@/lib/authorization/h6-economic-authorization'
import { createH6PaymentActions } from '@/lib/memberships/h6-payment-actions'
import { createDrizzleBillingDatabase } from '@/lib/memberships/billing-drizzle-database'
import type { EffectiveTeamMembership } from '@/lib/authorization/effective-authorization'

test('KAN-845 H3/H6 revocation denies real Drizzle payment revision mutation across Teams', async () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  try {
    sqlite.exec([
      'CREATE TABLE users (id text PRIMARY KEY)',
      'CREATE TABLE team_memberships (user_id text NOT NULL, team_id text NOT NULL, preset text NOT NULL, is_active integer NOT NULL, is_deleted integer NOT NULL, effective_from text NOT NULL, effective_until text)',
      'CREATE TABLE monthly_charges (id text PRIMARY KEY)',
      'CREATE TABLE payment_revisions (id text PRIMARY KEY, payment_id text NOT NULL, monthly_charge_id text NOT NULL REFERENCES monthly_charges(id), amount_minor integer NOT NULL, payment_method text NOT NULL, paid_at text NOT NULL, voided integer NOT NULL, is_current integer NOT NULL, is_deleted integer NOT NULL, created_at text NOT NULL, updated_at text NOT NULL, created_by_user_id text REFERENCES users(id) ON DELETE RESTRICT)',
      "INSERT INTO users VALUES ('coach-a')",
      "INSERT INTO team_memberships VALUES ('coach-a','team-a','coach',1,0,'2025-01-01',NULL),('coach-a','team-b','coach',1,0,'2025-01-01',NULL)",
      "INSERT INTO monthly_charges VALUES ('charge-a'),('charge-b')",
      "INSERT INTO payment_revisions VALUES ('rev-a1','payment-a','charge-a',100,'cash','2026-10-10',0,1,0,'2026-10-10','2026-10-10','coach-a')",
      "INSERT INTO payment_revisions VALUES ('rev-b1','payment-b','charge-b',200,'cash','2026-10-10',0,1,0,'2026-10-10','2026-10-10','coach-a')",
    ].join(';') + ';')
    const db = createDrizzleBillingDatabase(drizzle(sqlite))
    assert.ok(db.replaceCurrentPaymentRevisionAtomically)
    let selected: string | null = 'team-b'
    const load = () => sqlite.prepare('SELECT * FROM team_memberships WHERE user_id = ?')
      .all('coach-a') as Array<{ user_id: string; team_id: string; preset: 'coach'; is_active: number; is_deleted: number; effective_from: string; effective_until: string | null }>
    const active = () => resolveActiveTeamContext({
      persistedTeamId: selected,
      onDate: '2026-10-21',
      memberships: load().map(m => ({ teamId: m.team_id, isActive: Boolean(m.is_active), isDeleted: Boolean(m.is_deleted), effectiveFrom: m.effective_from, effectiveUntil: m.effective_until })),
    })
    const boundary = createH6EconomicAuthorizationBoundary({
      resolveActiveTeam: async () => active(),
      loadMemberships: async (userId, teamId): Promise<EffectiveTeamMembership[]> => load()
        .filter(m => m.user_id === userId && m.team_id === teamId)
        .map(m => ({ userId: m.user_id, teamId: m.team_id, preset: m.preset, effectiveFrom: m.effective_from, effectiveUntil: m.effective_until, isActive: Boolean(m.is_active) && !Boolean(m.is_deleted) })),
      resolveResourceTeam: async resourceId => resourceId === 'charge-b' ? 'team-b' : resourceId === 'charge-a' ? 'team-a' : null,
    })
    const before = () => sqlite.prepare('SELECT id, payment_id, monthly_charge_id, amount_minor, is_current FROM payment_revisions ORDER BY id').all()
    const current = { revisionId: 'rev-b1', paymentId: 'payment-b', monthlyChargeId: 'charge-b', amountMinor: 200, paymentMethod: 'cash' as const, paidAt: '2026-10-10', voided: false, isCurrent: true, createdByUserId: 'coach-a' }
    const actions = createH6PaymentActions({
      authenticate: async () => ({ status: 'authenticated' as const, userId: 'coach-a' }),
      authorize: (actor, request) => boundary.authorize(actor, request),
      ownsCharge: async (teamId, _athleteId, chargeId) => teamId === 'team-b' && chargeId === 'charge-b',
      ownsPayment: async (teamId, _athleteId, chargeId, paymentId) => teamId === 'team-b' && chargeId === 'charge-b' && paymentId === 'payment-b',
      register: async () => { throw new Error('unexpected registration') },
      correct: async (teamId) => {
        assert.equal(teamId, 'team-b')
        await db.replaceCurrentPaymentRevisionAtomically!(current, { ...current, revisionId: 'rev-b2', amountMinor: 250 })
        return { success: true as const }
      },
      voidPayment: async () => { throw new Error('unexpected void') },
      revalidate: () => {},
      now: () => '2026-10-21T12:00:00.000Z',
    })
    const input = { athleteId: 'athlete-b', monthlyChargeId: 'charge-b', paymentId: 'payment-b', amountMinor: 250, paymentMethod: 'cash' as const, paidAt: '2026-10-21', locale: 'es' as const }
    assert.equal((await actions.correct(input)).success, true)
    assert.deepEqual(sqlite.prepare("SELECT id, amount_minor, is_current FROM payment_revisions WHERE monthly_charge_id = 'charge-a'").all(), [{ id: 'rev-a1', amount_minor: 100, is_current: 1 }])
    const baseline = before()
    selected = 'team-a'
    assert.equal((await actions.correct(input)).success, false)
    assert.deepEqual(before(), baseline, 'foreign Team DENY must preserve all payment revisions')
    selected = 'team-b'
    sqlite.prepare("UPDATE team_memberships SET is_active = 0 WHERE team_id = 'team-b'").run()
    assert.equal((await actions.correct(input)).success, false)
    assert.deepEqual(before(), baseline, 'revoked membership DENY must preserve all revisions')
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})
