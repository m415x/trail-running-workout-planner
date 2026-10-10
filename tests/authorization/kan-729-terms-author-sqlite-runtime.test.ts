import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createMembershipServerActionRuntime } from '@/lib/memberships/billing-server-action-runtime'

test('KAN-729 SQLite retains factual author per terms version and rolls back invalid replacement', async () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.pragma('foreign_keys = ON')
    sqlite.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE teams (id TEXT PRIMARY KEY);
      INSERT INTO users(id) VALUES ('coach-a'), ('coach-b');
      INSERT INTO teams(id) VALUES ('team-a');
    `)
    // Keep the profile projection identical to the canonical SQLite snapshot.
    const snapshot = JSON.parse(readFileSync('drizzle/sqlite/meta/0021_snapshot.json', 'utf8')) as {
      tables: Record<string, { columns: Record<string, { type: string }> }>
    }
    const athleteColumns = snapshot.tables.athlete_profiles!.columns
    sqlite.exec('CREATE TABLE athlete_profiles (' + Object.entries(athleteColumns)
      .map(([name, column]) => '"' + name + '" ' + column.type)
      .join(', ') + ')')
    sqlite.exec(`
      INSERT INTO athlete_profiles(id, team_id, dni, is_deleted, is_active, created_at, updated_at)
      VALUES ('athlete-a', 'team-a', '12345', 0, 1, '2026-01-01', '2026-01-01');
      CREATE TABLE team_economic_policies (
        id TEXT PRIMARY KEY, team_id TEXT NOT NULL, default_monthly_amount_minor INTEGER NOT NULL,
        currency TEXT NOT NULL, ordinary_due_day INTEGER NOT NULL, effective_from TEXT NOT NULL,
        effective_until TEXT, created_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
        is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO team_economic_policies(id,team_id,default_monthly_amount_minor,currency,ordinary_due_day,
        effective_from,is_deleted,created_at,updated_at)
      VALUES ('policy-a','team-a',1000,'ARS',5,'2026-01-01',0,'2026-01-01','2026-01-01');
      CREATE TABLE athlete_billing_terms (
        id TEXT PRIMARY KEY, athlete_id TEXT NOT NULL, monthly_amount_minor INTEGER NOT NULL,
        currency TEXT NOT NULL, effective_from TEXT NOT NULL, effective_until TEXT,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
        is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `)
    const ids = ['terms-1', 'terms-2', 'terms-3']
    const runtime = createMembershipServerActionRuntime({
      db: drizzle(sqlite), createId: () => ids.shift()!, reportError: () => {},
    })
    const author = (id: string) => ({ authenticatedActorUserId: id, effectiveActorUserId: id })
    const read = () => sqlite.prepare(
      'SELECT id, effective_until AS until, created_by_user_id AS author FROM athlete_billing_terms ORDER BY effective_from'
    ).all()
    assert.deepEqual(await runtime.applyInitialAthleteBillingTerms({
      teamId: 'team-a', athleteId: 'athlete-a', effectiveFrom: '2026-10-01', authorship: author('coach-a'),
    }), { success: true })
    assert.deepEqual(await runtime.changeAthleteBillingTerms({
      teamId: 'team-a', athleteId: 'athlete-a', effectiveFrom: '2026-11-01',
      monthlyAmountMinor: 1200, currency: 'ARS', authorship: author('coach-b'),
    }), { success: true })
    const expected = [
      { id: 'terms-1', until: '2026-11-01', author: 'coach-a' },
      { id: 'terms-2', until: null, author: 'coach-b' },
    ]
    assert.deepEqual(read(), expected)
    const failed = await runtime.changeAthleteBillingTerms({
      teamId: 'team-a', athleteId: 'athlete-a', effectiveFrom: '2026-12-01',
      monthlyAmountMinor: 1500, currency: 'ARS', authorship: author('unknown-user'),
    })
    assert.equal(failed.success, false)
    assert.deepEqual(read(), expected, 'invalid author must not close or append a billing terms version')
  } finally {
    sqlite.close()
  }
})
