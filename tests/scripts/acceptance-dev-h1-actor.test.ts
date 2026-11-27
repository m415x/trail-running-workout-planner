import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { assertAcceptanceH1Actor } from '@/scripts/acceptance-dev-h1-actor'

const subject = 'kan885-test-subject-not-a-credential'
const teamId = 'kan885-test-team'

function withActorFixture(
  setup: (sqlite: Database.Database) => void,
  verify: (sqlite: Database.Database) => void,
): void {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec("CREATE TABLE users (id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0)")
    sqlite.exec("CREATE TABLE external_identity_links (user_id TEXT, provider TEXT, subject TEXT, is_deleted INTEGER NOT NULL DEFAULT 0)")
    sqlite.exec("CREATE TABLE team_memberships (user_id TEXT, team_id TEXT, preset TEXT, is_active INTEGER NOT NULL DEFAULT 1, is_deleted INTEGER NOT NULL DEFAULT 0, effective_from TEXT, effective_until TEXT)")
    sqlite.prepare("INSERT INTO users(id) VALUES ('kan885-test-user')").run()
    setup(sqlite)
    sqlite.pragma('query_only = ON')
    verify(sqlite)
    assert.equal(sqlite.pragma('query_only', { simple: true }), 1)
  } finally {
    sqlite.close()
  }
}

function insertLink(sqlite: Database.Database): void {
  sqlite.prepare(
    "INSERT INTO external_identity_links(user_id, provider, subject) VALUES ('kan885-test-user', 'supabase', ?)",
  ).run(subject)
}

function insertMembership(sqlite: Database.Database, team = teamId, active = 1): void {
  sqlite.prepare(
    "INSERT INTO team_memberships(user_id, team_id, preset, is_active, effective_from) VALUES ('kan885-test-user', ?, 'coach', ?, '2020-01-01T00:00:00.000Z')",
  ).run(team, active)
}

test('KAN-885/T2 H1 actor preflight rejects a missing Supabase identity link without provisioning', () => {
  withActorFixture(
    sqlite => insertMembership(sqlite),
    sqlite => {
      const before = sqlite.prepare('SELECT * FROM external_identity_links').all()
      assert.throws(
        () => assertAcceptanceH1Actor({ sqlite, subject, teamId }),
        /H1|identity|link|vínculo|subject|accredit/i,
      )
      assert.deepEqual(sqlite.prepare('SELECT * FROM external_identity_links').all(), before)
    },
  )
})

test('KAN-885/T2 H1 actor preflight rejects an inactive or wrong-Team membership', () => {
  for (const membership of [{ team: teamId, active: 0 }, { team: 'other-team', active: 1 }]) {
    withActorFixture(
      sqlite => {
        insertLink(sqlite)
        insertMembership(sqlite, membership.team, membership.active)
      },
      sqlite => {
        assert.throws(
          () => assertAcceptanceH1Actor({ sqlite, subject, teamId }),
          /H1|membership|team|active|preset|accredit/i,
        )
      },
    )
  }
})

test('KAN-885/T2 H1 actor preflight accepts an existing active Supabase/Team association read-only', () => {
  withActorFixture(
    sqlite => {
      insertLink(sqlite)
      insertMembership(sqlite)
    },
    sqlite => {
      assert.doesNotThrow(() => assertAcceptanceH1Actor({ sqlite, subject, teamId }))
      assert.equal(
        (sqlite.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n, 1,
      )
    },
  )
})
