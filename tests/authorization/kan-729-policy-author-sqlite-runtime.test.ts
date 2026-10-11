import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createMembershipServerActionRuntime } from '@/lib/memberships/billing-server-action-runtime'

test('KAN-729 SQLite persists verified policy author and preserves prior version on replacement', async () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.pragma('foreign_keys = ON')
    sqlite.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE teams (id TEXT PRIMARY KEY);
      INSERT INTO users(id) VALUES ('coach-h2');
      INSERT INTO teams(id) VALUES ('team-a');
      CREATE TABLE team_economic_policies (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL REFERENCES teams(id),
        default_monthly_amount_minor INTEGER NOT NULL,
        currency TEXT NOT NULL,
        ordinary_due_day INTEGER NOT NULL,
        effective_from TEXT NOT NULL,
        effective_until TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
    sqlite.exec('ALTER TABLE team_economic_policies ADD created_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT')
    const db = drizzle(sqlite)
    const ids = ['policy-1', 'policy-2', 'policy-3']
    const runtime = createMembershipServerActionRuntime({ db, createId: () => ids.shift()! })
    const authorship = { authenticatedActorUserId: 'coach-h2', effectiveActorUserId: 'coach-h2' }
    const base = { teamId: 'team-a', defaultMonthlyAmountMinor: 1000, currency: 'ARS', ordinaryDueDay: 5, authorship }
    assert.deepEqual(await runtime.configureTeamEconomicPolicy({ ...base, effectiveFrom: '2026-10-01' }), { success: true })
    assert.deepEqual(await runtime.configureTeamEconomicPolicy({ ...base, effectiveFrom: '2026-11-01' }), { success: true })
    const rows = sqlite.prepare('SELECT id, created_by_user_id AS author, effective_until AS until FROM team_economic_policies ORDER BY effective_from').all() as Array<{id:string;author:string|null;until:string|null}>
    assert.deepEqual(rows, [
      { id: 'policy-1', author: 'coach-h2', until: '2026-11-01' },
      { id: 'policy-2', author: 'coach-h2', until: null },
    ])
    const invalid = await runtime.configureTeamEconomicPolicy({
      ...base, effectiveFrom: '2026-12-01',
      authorship: { authenticatedActorUserId: 'unknown-user', effectiveActorUserId: 'unknown-user' },
    })
    assert.equal(invalid.success, false, 'invalid author FK must roll back the change')
    const after = sqlite.prepare('SELECT id, effective_until AS until FROM team_economic_policies ORDER BY effective_from').all()
    assert.deepEqual(after, [
      { id: 'policy-1', until: '2026-11-01' },
      { id: 'policy-2', until: null },
    ])
  } finally {
    sqlite.close()
  }
})
