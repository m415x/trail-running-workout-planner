import assert from 'node:assert/strict'
import test from 'node:test'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from '../../db/schema'
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
  `)

  const now = '2026-10-05T18:00:00.000Z'

  sqlite.prepare(`
    INSERT INTO users (
      id, created_at, updated_at, role, user_name, email, first_name, last_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'user-1',
    now,
    now,
    'admin',
    'legacy.admin',
    'legacy-admin@example.test',
    'Legacy',
    'Admin',
  )

  const insertTeam = sqlite.prepare(`
    INSERT INTO teams (id, created_at, updated_at, name)
    VALUES (?, ?, ?, ?)
  `)
  insertTeam.run('team-a', now, now, 'Team A')
  insertTeam.run('team-b', now, now, 'Team B')

  const insertAthlete = sqlite.prepare(`
    INSERT INTO athlete_profiles (
      id, created_at, updated_at, user_id, team_id, first_name, last_name, dni
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertAthlete.run('athlete-a', now, now, 'user-1', 'team-a', 'Legacy', 'Admin', '30000001')
  insertAthlete.run('athlete-b', now, now, 'user-1', 'team-b', 'Legacy', 'Admin', '30000002')

  return { sqlite, db: drizzle(sqlite, { schema }) }
}

function insertMembership(
  sqlite: Database.Database,
  input: {
    id: string
    teamId: string
    preset: 'admin' | 'coach' | 'athlete'
    effectiveFrom: string
    effectiveUntil?: string | null
    isActive?: boolean
  },
) {
  sqlite.prepare(`
    INSERT INTO team_memberships (
      id,
      created_at,
      updated_at,
      user_id,
      team_id,
      preset,
      effective_from,
      effective_until,
      is_active
    ) VALUES (?, ?, ?, 'user-1', ?, ?, ?, ?, ?)
  `).run(
    input.id,
    '2026-10-05T18:00:00.000Z',
    '2026-10-05T18:00:00.000Z',
    input.teamId,
    input.preset,
    input.effectiveFrom,
    input.effectiveUntil ?? null,
    input.isActive === false ? 0 : 1,
  )
}

test('KAN-617 resolves different presets for the same EPT User in different teams', () => {
  const { sqlite, db } = fixture()

  try {
    insertMembership(sqlite, {
      id: 'membership-a',
      teamId: 'team-a',
      preset: 'coach',
      effectiveFrom: '2026-01-01',
    })
    insertMembership(sqlite, {
      id: 'membership-b',
      teamId: 'team-b',
      preset: 'athlete',
      effectiveFrom: '2026-01-01',
    })

    assert.equal(
      resolveTeamMembershipPreset(db, {
        userId: 'user-1',
        teamId: 'team-a',
        onDate: '2026-10-05',
      }),
      'coach',
    )
    assert.equal(
      resolveTeamMembershipPreset(db, {
        userId: 'user-1',
        teamId: 'team-b',
        onDate: '2026-10-05',
      }),
      'athlete',
    )
  } finally {
    sqlite.close()
  }
})

test('KAN-617 ignores expired and inactive memberships', () => {
  const { sqlite, db } = fixture()

  try {
    insertMembership(sqlite, {
      id: 'expired',
      teamId: 'team-a',
      preset: 'coach',
      effectiveFrom: '2026-01-01',
      effectiveUntil: '2026-09-01',
    })
    insertMembership(sqlite, {
      id: 'inactive',
      teamId: 'team-b',
      preset: 'coach',
      effectiveFrom: '2026-01-01',
      isActive: false,
    })

    assert.equal(
      resolveTeamMembershipPreset(db, {
        userId: 'user-1',
        teamId: 'team-a',
        onDate: '2026-10-05',
      }),
      null,
    )
    assert.equal(
      resolveTeamMembershipPreset(db, {
        userId: 'user-1',
        teamId: 'team-b',
        onDate: '2026-10-05',
      }),
      null,
    )
  } finally {
    sqlite.close()
  }
})

test('KAN-617 TeamMembership wins over conflicting legacy users.role', () => {
  const { sqlite, db } = fixture()

  try {
    insertMembership(sqlite, {
      id: 'membership-a',
      teamId: 'team-a',
      preset: 'athlete',
      effectiveFrom: '2026-01-01',
    })

    assert.equal(
      resolveTeamMembershipPreset(db, {
        userId: 'user-1',
        teamId: 'team-a',
        onDate: '2026-10-05',
      }),
      'athlete',
    )
  } finally {
    sqlite.close()
  }
})

test('KAN-617 absence of TeamMembership fails closed without users.role fallback', () => {
  const { sqlite, db } = fixture()

  try {
    const legacyRole = sqlite.prepare(
      'SELECT role FROM users WHERE id = ?',
    ).get('user-1') as { role: string }

    assert.equal(legacyRole.role, 'admin')
    assert.equal(
      resolveTeamMembershipPreset(db, {
        userId: 'user-1',
        teamId: 'team-a',
        onDate: '2026-10-05',
      }),
      null,
    )
  } finally {
    sqlite.close()
  }
})

test('KAN-617 revoking membership preserves User and AthleteProfile records', () => {
  const { sqlite, db } = fixture()

  try {
    insertMembership(sqlite, {
      id: 'membership-a',
      teamId: 'team-a',
      preset: 'coach',
      effectiveFrom: '2026-01-01',
    })

    sqlite.prepare(`
      UPDATE team_memberships
      SET is_active = 0, effective_until = '2026-10-05'
      WHERE id = 'membership-a'
    `).run()

    assert.equal(
      resolveTeamMembershipPreset(db, {
        userId: 'user-1',
        teamId: 'team-a',
        onDate: '2026-10-05',
      }),
      null,
    )
    assert.ok(sqlite.prepare('SELECT id FROM users WHERE id = ?').get('user-1'))
    assert.ok(sqlite.prepare('SELECT id FROM athlete_profiles WHERE id = ?').get('athlete-a'))
  } finally {
    sqlite.close()
  }
})
