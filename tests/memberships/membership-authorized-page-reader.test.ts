import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'

import { resolveActiveTeamContext } from '../../lib/authorization/active-team-context'
import { createMembershipPageLoader } from '../../lib/memberships/membership-page-loader'

// KAN-689/T1 RED: disposable persistence, never the developer sqlite.db.
// Canonical-shaped team_memberships and H3 resolver; not an HTTP-authenticated session test.
// Positive scenarios exercise existing projection with H3-derived Team; the RED is
// the production-page wiring assertion. The GREEN must introduce direct boundary tests.
function scenario() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE team_memberships (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, team_id TEXT NOT NULL, preset TEXT NOT NULL, is_active INTEGER NOT NULL, is_deleted INTEGER NOT NULL, effective_from TEXT NOT NULL, effective_until TEXT);
    CREATE TABLE fixture_policy (team_id TEXT, amount INTEGER);
    CREATE TABLE fixture_exception (team_id TEXT, reason TEXT);
    INSERT INTO team_memberships VALUES
      ('membership_A','coach_1','team_A','coach',1,0,'2025-01-01',NULL),
      ('membership_B','coach_1','team_B','coach',1,0,'2025-01-01',NULL);
    INSERT INTO fixture_policy VALUES ('team_A',10000),('team_B',20000);
    INSERT INTO fixture_exception VALUES ('team_A','private-A'),('team_B','private-B');
  `)
  const memberships = sqlite.prepare('SELECT * FROM team_memberships WHERE user_id = ?').all('coach_1') as Array<{
    team_id: string; is_active: number; is_deleted: number; effective_from: string; effective_until: string | null
  }>
  const resolve = (selected: string | null) => resolveActiveTeamContext({
    persistedTeamId: selected,
    onDate: '2026-10-21',
    memberships: memberships.map(row => ({
      teamId: row.team_id, isActive: Boolean(row.is_active), isDeleted: Boolean(row.is_deleted),
      effectiveFrom: row.effective_from, effectiveUntil: row.effective_until,
    })),
  })
  const calls: string[] = []
  const load = createMembershipPageLoader({
    createRepository: () => ({
      async listTeamEconomicPolicies(teamId: string) {
        calls.push('policy:' + teamId)
        const row = sqlite.prepare('SELECT amount FROM fixture_policy WHERE team_id = ?').get(teamId) as { amount: number } | undefined
        return row ? [{
          id: 'policy-' + teamId, teamId, defaultMonthlyAmountMinor: row.amount,
          currency: 'ARS', ordinaryDueDay: 5, effectiveFrom: '2026-10-01', effectiveUntil: null,
        }] : []
      },
      async listGlobalDueDateExceptionRevisions(teamId: string) {
        calls.push('exception:' + teamId)
        const rows = sqlite.prepare('SELECT reason FROM fixture_exception WHERE team_id = ?').all(teamId) as Array<{ reason: string }>
        return rows.map((row, i) => ({
          id: String(i), teamId, year: 2026, month: 10, dueDate: '2026-10-10',
          reason: row.reason, isCurrent: true, createdByUserId: null,
        }))
      },
    }),
  })
  return { sqlite, resolve, calls, load }
}

test('KAN-689/T1: H3-selected Team B scopes both persisted economic queries', async () => {
  const s = scenario()
  try {
    const active = s.resolve('team_B')
    assert.equal(active.status, 'resolved')
    if (active.status !== 'resolved') return
    // H3 is the only legitimate source of Team for the projection.
    const model = await s.load({ db: s.sqlite, locale: 'es', teamId: active.teamId, onDate: '2026-10-21' })
    assert.deepEqual(s.calls, ['policy:team_B', 'exception:team_B'])
    assert.equal(model.currentPolicy.monthlyAmount, new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(100))
  } finally { s.sqlite.close() }
})

test('KAN-689/T1: selection_required must not invoke the economic projection', async () => {
  const s = scenario()
  try {
    assert.equal(s.resolve(null).status, 'selection_required')
    // The proposed server boundary must not invoke the projector on unresolved H3.
    assert.deepEqual(s.calls, [])
  } finally { s.sqlite.close() }
})

test('KAN-689/T1: revoked Team becomes invalid_context before economic projection', async () => {
  const s = scenario()
  try {
    s.sqlite.prepare("UPDATE team_memberships SET is_active=0 WHERE team_id='team_B'").run()
    const rows = s.sqlite.prepare("SELECT * FROM team_memberships WHERE user_id='coach_1'").all() as Array<{team_id: string; is_active: number; is_deleted: number; effective_from: string; effective_until: string | null}>
    const decision = resolveActiveTeamContext({
      persistedTeamId: 'team_B', onDate: '2026-10-21',
      memberships: rows.map(x => ({ teamId:x.team_id, isActive:Boolean(x.is_active), isDeleted:Boolean(x.is_deleted),
        effectiveFrom:x.effective_from, effectiveUntil:x.effective_until })),
    })
    assert.equal(decision.status, 'invalid_context')
    assert.deepEqual(s.calls, [])
  } finally { s.sqlite.close() }
})

test('KAN-689/T1 RED: production Membership page cannot hardcode Team or bypass server authorization', () => {
  const source = readFileSync('app/[locale]/dashboard/membership/page.tsx', 'utf8')
  assert.doesNotMatch(source, /teamId:\s*['"]team_1['"]/)
  assert.match(source, /(?:createH4aNextServerAuthorizationBoundary|createMembershipAuthorizedPageReader)/)
})
