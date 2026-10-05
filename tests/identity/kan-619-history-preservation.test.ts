import assert from 'node:assert/strict'
import test from 'node:test'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from '../../db/schema'
import { setAthleteProfileActiveState } from '../../lib/athletes/athlete-profile-lifecycle'
import { revokeTeamMembership } from '../../lib/identity/team-membership-lifecycle'
import { resolveTeamMembershipPreset } from '../../lib/identity/team-membership'

function fixture() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'athlete',
      user_name TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      avatar TEXT
    );

    CREATE TABLE teams (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      avatar_light TEXT,
      avatar_dark TEXT
    );

    CREATE TABLE athlete_profiles (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      user_id TEXT,
      team_id TEXT NOT NULL,
      group_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      first_name TEXT,
      last_name TEXT,
      contact_email TEXT,
      nick_name TEXT,
      dni TEXT NOT NULL,
      birthday TEXT,
      phone TEXT,
      emergency_contact TEXT,
      emergency_phone TEXT,
      physiology TEXT,
      medical TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    );

    CREATE TABLE team_memberships (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      user_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      preset TEXT NOT NULL,
      effective_from TEXT NOT NULL,
      effective_until TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT
    );

    CREATE TABLE group_history_records (
      id TEXT PRIMARY KEY,
      athlete_id TEXT NOT NULL,
      changed_by_user_id TEXT,
      date TEXT NOT NULL,
      FOREIGN KEY (athlete_id) REFERENCES athlete_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE athlete_billing_terms (
      id TEXT PRIMARY KEY,
      athlete_id TEXT NOT NULL,
      monthly_amount_minor INTEGER NOT NULL,
      currency TEXT NOT NULL,
      effective_from TEXT NOT NULL,
      effective_until TEXT,
      FOREIGN KEY (athlete_id) REFERENCES athlete_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE monthly_charges (
      id TEXT PRIMARY KEY,
      athlete_id TEXT NOT NULL,
      billing_terms_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      amount_minor INTEGER NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      FOREIGN KEY (athlete_id) REFERENCES athlete_profiles(id) ON DELETE RESTRICT,
      FOREIGN KEY (billing_terms_id) REFERENCES athlete_billing_terms(id) ON DELETE RESTRICT
    );
  `)

  const now = '2026-10-05T18:00:00.000Z'
  sqlite.prepare(`
    INSERT INTO users (
      id, created_at, updated_at, role, user_name, email, first_name, last_name
    ) VALUES ('user-1', ?, ?, 'admin', 'legacy.admin', 'legacy@example.test', 'Legacy', 'Admin')
  `).run(now, now)

  const team = sqlite.prepare(`
    INSERT INTO teams (id, created_at, updated_at, name) VALUES (?, ?, ?, ?)
  `)
  team.run('team-a', now, now, 'Team A')
  team.run('team-b', now, now, 'Team B')

  const athlete = sqlite.prepare(`
    INSERT INTO athlete_profiles (
      id, created_at, updated_at, user_id, team_id, first_name, last_name, dni
    ) VALUES (?, ?, ?, 'user-1', ?, 'Legacy', 'Admin', ?)
  `)
  athlete.run('athlete-a', now, now, 'team-a', '30000001')
  athlete.run('athlete-b', now, now, 'team-b', '30000002')

  const membership = sqlite.prepare(`
    INSERT INTO team_memberships (
      id, created_at, updated_at, user_id, team_id, preset, effective_from, is_active
    ) VALUES (?, ?, ?, 'user-1', ?, ?, '2026-01-01', 1)
  `)
  membership.run('membership-a', now, now, 'team-a', 'coach')
  membership.run('membership-b', now, now, 'team-b', 'athlete')

  sqlite.prepare(`
    INSERT INTO group_history_records (id, athlete_id, changed_by_user_id, date)
    VALUES ('history-a', 'athlete-a', 'user-1', '2026-03-01')
  `).run()

  sqlite.prepare(`
    INSERT INTO athlete_billing_terms (
      id, athlete_id, monthly_amount_minor, currency, effective_from
    ) VALUES ('billing-a', 'athlete-a', 2500000, 'ARS', '2026-01-01')
  `).run()

  sqlite.prepare(`
    INSERT INTO monthly_charges (
      id, athlete_id, billing_terms_id, year, month, amount_minor, currency, status
    ) VALUES ('charge-a', 'athlete-a', 'billing-a', 2026, 9, 2500000, 'ARS', 'settled')
  `).run()

  return { sqlite, db: drizzle(sqlite, { schema }) }
}

test('KAN-619 revokes one team membership without deleting or transferring historical evidence', () => {
  const { sqlite, db } = fixture()

  try {
    revokeTeamMembership(db, {
      userId: 'user-1',
      teamId: 'team-a',
      effectiveUntil: '2026-10-05',
      updatedAt: '2026-10-05T18:30:00.000Z',
    })

    assert.equal(resolveTeamMembershipPreset(db, {
      userId: 'user-1',
      teamId: 'team-a',
      onDate: '2026-10-05',
    }), null)
    assert.equal(resolveTeamMembershipPreset(db, {
      userId: 'user-1',
      teamId: 'team-b',
      onDate: '2026-10-05',
    }), 'athlete')

    assert.deepEqual(
      sqlite.prepare('SELECT id, team_id, is_active, effective_until FROM team_memberships ORDER BY id').all(),
      [
        { id: 'membership-a', team_id: 'team-a', is_active: 0, effective_until: '2026-10-05' },
        { id: 'membership-b', team_id: 'team-b', is_active: 1, effective_until: null },
      ],
    )

    assert.ok(sqlite.prepare('SELECT id FROM users WHERE id = ?').get('user-1'))
    assert.deepEqual(
      sqlite.prepare('SELECT id, team_id FROM athlete_profiles ORDER BY id').all(),
      [
        { id: 'athlete-a', team_id: 'team-a' },
        { id: 'athlete-b', team_id: 'team-b' },
      ],
    )
    assert.deepEqual(
      sqlite.prepare('SELECT id, athlete_id, changed_by_user_id FROM group_history_records').get(),
      { id: 'history-a', athlete_id: 'athlete-a', changed_by_user_id: 'user-1' },
    )
    assert.deepEqual(
      sqlite.prepare('SELECT id, athlete_id, billing_terms_id FROM monthly_charges').get(),
      { id: 'charge-a', athlete_id: 'athlete-a', billing_terms_id: 'billing-a' },
    )
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})

test('KAN-619 athlete deactivation is team scoped and preserves IDs and references', () => {
  const { sqlite, db } = fixture()

  try {
    assert.throws(
      () => setAthleteProfileActiveState(db, {
        teamId: 'team-b',
        athleteId: 'athlete-a',
        isActive: false,
        updatedAt: '2026-10-05T18:30:00.000Z',
      }),
      /athlete not found/i,
    )

    setAthleteProfileActiveState(db, {
      teamId: 'team-a',
      athleteId: 'athlete-a',
      isActive: false,
      updatedAt: '2026-10-05T18:30:00.000Z',
    })

    assert.deepEqual(
      sqlite.prepare('SELECT id, team_id, is_active FROM athlete_profiles ORDER BY id').all(),
      [
        { id: 'athlete-a', team_id: 'team-a', is_active: 0 },
        { id: 'athlete-b', team_id: 'team-b', is_active: 1 },
      ],
    )
    assert.ok(sqlite.prepare('SELECT id FROM group_history_records WHERE id = ?').get('history-a'))
    assert.ok(sqlite.prepare('SELECT id FROM athlete_billing_terms WHERE id = ?').get('billing-a'))
    assert.ok(sqlite.prepare('SELECT id FROM monthly_charges WHERE id = ?').get('charge-a'))

    setAthleteProfileActiveState(db, {
      teamId: 'team-a',
      athleteId: 'athlete-a',
      isActive: true,
      updatedAt: '2026-10-05T19:00:00.000Z',
    })

    assert.equal(
      (sqlite.prepare('SELECT is_active FROM athlete_profiles WHERE id = ?').get('athlete-a') as { is_active: number }).is_active,
      1,
    )
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})
