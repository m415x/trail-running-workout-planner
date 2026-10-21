import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { resolveActiveTeamContext } from '@/lib/authorization/active-team-context'
import { createH6EconomicAuthorizationBoundary } from '@/lib/authorization/h6-economic-authorization'
import { createH6PolicyAction } from '@/lib/memberships/h6-policy-action'
import { createMembershipAuthorizedPageReader } from '@/lib/memberships/membership-authorized-page-reader'
import type { EffectiveTeamMembership } from '@/lib/authorization/effective-authorization'

// KAN-845: Disposable SQLite fixture. Authenticated H2 is injected, NOT Supabase HTTP.
// This first tranche proves persistence-backed H3/H4A decisions and durable DENY
// for policy writes/reads; the complete economic-table acceptance is a later tranche.
const at = '2026-10-21T12:00:00.000Z'
const onDate = '2026-10-21'
const actor = { status: 'authenticated' as const, userId: 'coach_a' }

function fixture() {
  const sql = new Database(':memory:')
  sql.exec(`
    CREATE TABLE team_memberships (
      user_id TEXT NOT NULL, team_id TEXT NOT NULL, preset TEXT NOT NULL,
      is_active INTEGER NOT NULL, is_deleted INTEGER NOT NULL,
      effective_from TEXT NOT NULL, effective_until TEXT
    );
    CREATE TABLE team_economic_policies (team_id TEXT NOT NULL, amount_minor INTEGER NOT NULL);
    CREATE TABLE global_due_date_exceptions (team_id TEXT NOT NULL, year INTEGER, month INTEGER, due_date TEXT);
    CREATE TABLE monthly_charges (team_id TEXT NOT NULL, athlete_id TEXT NOT NULL, amount_minor INTEGER);
    CREATE TABLE payment_revisions (team_id TEXT NOT NULL, charge_id TEXT NOT NULL, amount_minor INTEGER);
    INSERT INTO team_memberships VALUES
      ('coach_a','team_a','coach',1,0,'2025-01-01',NULL),
      ('coach_a','team_b','coach',1,0,'2025-01-01',NULL);
    INSERT INTO team_economic_policies VALUES ('team_a',10000),('team_b',20000);
    INSERT INTO global_due_date_exceptions VALUES ('team_a',2026,10,'2026-10-10'),('team_b',2026,10,'2026-10-11');
    INSERT INTO monthly_charges VALUES ('team_a','athlete_a',10000),('team_b','athlete_b',20000);
    INSERT INTO payment_revisions VALUES ('team_a','charge_a',2000),('team_b','charge_b',4000);
  `)
  let selected: string | null = 'team_b'
  const memberships = () => sql.prepare('SELECT * FROM team_memberships WHERE user_id = ?')
    .all(actor.userId) as Array<{
      user_id: string; team_id: string; preset: 'coach'; is_active: number;
      is_deleted: number; effective_from: string; effective_until: string | null
    }>
  const resolve = () => resolveActiveTeamContext({
    persistedTeamId: selected, onDate,
    memberships: memberships().map(m => ({
      teamId: m.team_id, isActive: Boolean(m.is_active), isDeleted: Boolean(m.is_deleted),
      effectiveFrom: m.effective_from, effectiveUntil: m.effective_until,
    })),
  })
  const boundary = createH6EconomicAuthorizationBoundary({
    resolveActiveTeam: async () => resolve(),
    loadMemberships: async (userId, teamId): Promise<EffectiveTeamMembership[]> =>
      memberships().filter(m => m.user_id === userId && m.team_id === teamId)
        .map(m => ({
          userId: m.user_id, teamId: m.team_id, preset: m.preset,
          effectiveFrom: m.effective_from, effectiveUntil: m.effective_until,
          isActive: Boolean(m.is_active) && !Boolean(m.is_deleted),
        })),
    resolveResourceTeam: async (id, teamId) => {
      if (id !== '__active_team_policy__' && id !== '__active_team_economy__') return null
      return sql.prepare('SELECT team_id FROM team_economic_policies WHERE team_id = ?')
        .get(teamId) ? teamId : null
    },
  })
  const snapshot = () => ['team_economic_policies', 'global_due_date_exceptions', 'monthly_charges', 'payment_revisions']
    .map(table => [table, sql.prepare(`SELECT * FROM ${table} ORDER BY team_id`).all()])
  const policy = createH6PolicyAction({
    authenticate: async () => actor,
    authorize: (access, request) => boundary.authorize(access, request),
    configure: async (teamId, input) => {
      sql.prepare('INSERT INTO team_economic_policies (team_id, amount_minor) VALUES (?, ?)')
        .run(teamId, input.defaultMonthlyAmountMinor)
      return { success: true as const }
    },
    revalidate: () => {},
    now: () => at,
  })
  let reads = 0
  const page = createMembershipAuthorizedPageReader({
    authenticate: async () => actor,
    resolveActiveTeam: async () => resolve(),
    authorize: async (access, teamId, checkedAt) => {
      // The page reader shares the same policy capability but uses Team selection
      // already produced by the persisted H3 membership resolver.
      if (resolve().status !== 'resolved') return { allowed: false }
      const decision = await boundary.authorize(access, {
        at: checkedAt, capability: 'economic_policy.manage', resourceId: '__active_team_policy__',
      })
      return { allowed: decision.allowed && decision.teamId === teamId }
    },
    load: async ({ teamId }) => {
      reads++
      return {
        policy: sql.prepare('SELECT amount_minor FROM team_economic_policies WHERE team_id = ?').all(teamId),
        exceptions: sql.prepare('SELECT * FROM global_due_date_exceptions WHERE team_id = ?').all(teamId),
        charges: sql.prepare('SELECT * FROM monthly_charges WHERE team_id = ?').all(teamId),
        payments: sql.prepare('SELECT * FROM payment_revisions WHERE team_id = ?').all(teamId),
      }
    },
    hasData: m => m.policy.length > 0,
  })
  return {
    sql, policy, page, snapshot, reads: () => reads,
    select: (teamId: string | null) => { selected = teamId },
    revoke: (teamId: string) => sql.prepare('UPDATE team_memberships SET is_active = 0 WHERE user_id = ? AND team_id = ?').run(actor.userId, teamId),
  }
}
const policyInput = { effectiveFrom: '2026-11-01', defaultMonthlyAmountMinor: 25000, currency: 'ARS', ordinaryDueDay: 5 }

test('KAN-845 persisted Team B authorization scopes economic reads and policy mutation', async () => {
  const s = fixture()
  try {
    const read = await s.page({ db: s.sql, locale: 'es', onDate })
    assert.equal(read.status, 'ready')
    if (read.status !== 'ready') return
    assert.equal(read.teamId, 'team_b')
    assert.deepEqual(read.model.policy, [{ amount_minor: 20000 }])
    assert.equal(read.model.exceptions.length, 1)
    assert.equal(read.model.charges.length, 1)
    assert.equal(read.model.payments.length, 1)
    assert.equal((await s.policy(policyInput)).success, true)
    assert.deepEqual(s.sql.prepare('SELECT amount_minor FROM team_economic_policies WHERE team_id = ? ORDER BY amount_minor')
      .all('team_b'), [{ amount_minor: 20000 }, { amount_minor: 25000 }])
    assert.deepEqual(s.sql.prepare('SELECT amount_minor FROM team_economic_policies WHERE team_id = ?')
      .all('team_a'), [{ amount_minor: 10000 }])
  } finally { s.sql.close() }
})

test('KAN-845 forged Team selection, revoked membership and missing selection cannot mutate economic SQLite', async () => {
  const s = fixture()
  try {
    for (const selected of ['team_unknown', 'team_a', null] as const) {
      if (selected === 'team_a') s.revoke('team_a')
      if (selected === null) s.revoke('team_b')
      s.select(selected)
      const before = s.snapshot()
      const priorReads = s.reads()
      const result = await s.page({ db: s.sql, locale: 'en', onDate })
      assert.ok(result.status === 'invalid_context' || result.status === 'selection_required')
      assert.equal(s.reads(), priorReads, 'DENY cannot reach economic readers')
      assert.equal((await s.policy(policyInput)).success, false)
      assert.deepEqual(s.snapshot(), before, 'DENY cannot mutate policies, exceptions, charges or payments')
    }
  } finally { s.sql.close() }
})

test('KAN-845 policy writer rejects assistant capability with full economic snapshot unchanged', async () => {
  const s = fixture()
  try {
    s.sql.prepare("UPDATE team_memberships SET preset = 'assistant' WHERE team_id = 'team_b'").run()
    const before = s.snapshot()
    const result = await s.policy(policyInput)
    assert.equal(result.success, false)
    assert.deepEqual(s.snapshot(), before, 'assistant cannot change Team economic policy')
  } finally { s.sql.close() }
})
