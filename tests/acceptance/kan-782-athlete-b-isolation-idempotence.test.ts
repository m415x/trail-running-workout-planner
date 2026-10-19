import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { provisionAcceptanceAthleteB } from '@/lib/acceptance/athlete-b-provisioning'

const actor = {
  userId: 'accept_athlete_b',
  profileId: 'accept_profile_athlete_b',
  linkId: 'accept_link_athlete_b',
  membershipId: 'accept_membership_athlete_b',
  subject: 'synthetic-subject-b-not-real',
}

function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE teams(id TEXT PRIMARY KEY);
    CREATE TABLE users(id TEXT PRIMARY KEY, email TEXT NOT NULL);
    CREATE TABLE external_identity_links(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), provider TEXT NOT NULL, subject TEXT NOT NULL, UNIQUE(provider, subject));
    CREATE TABLE team_memberships(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), team_id TEXT NOT NULL REFERENCES teams(id), preset TEXT NOT NULL, is_active INTEGER NOT NULL);
    CREATE TABLE athlete_profiles(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), team_id TEXT NOT NULL REFERENCES teams(id), group_id TEXT NULL);
    INSERT INTO teams(id) VALUES ('team_1'), ('team_2');
    INSERT INTO users(id,email) VALUES ('accept_h4b_athlete','first@example.invalid');
  `)
  return db
}

function snapshot(db: Database.Database) {
  return ['users', 'external_identity_links', 'team_memberships', 'athlete_profiles']
    .map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()])
}

test('KAN-782 rerun on complete actor is strictly read-only and preserves original actor', () => {
  const db = fixture()
  try {
    assert.equal(provisionAcceptanceAthleteB({ db, actor, apply: true }), 'created')
    const before = snapshot(db)
    assert.equal(provisionAcceptanceAthleteB({ db, actor, apply: true }), 'complete')
    assert.deepEqual(snapshot(db), before)
    assert.deepEqual(db.pragma('foreign_key_check'), [])
  } finally { db.close() }
})

test('KAN-782 rejects another acceptance actor identity rather than provisioning it as B', () => {
  const db = fixture()
  try {
    const before = snapshot(db)
    assert.throws(() => provisionAcceptanceAthleteB({
      db, actor: { ...actor, userId: 'accept_h4b_coach' }, apply: true,
    }), /incompatible/i)
    assert.deepEqual(snapshot(db), before)
  } finally { db.close() }
})

test('KAN-782 insertion failure rolls back all four records atomically', () => {
  const db = fixture()
  try {
    db.exec(`CREATE TRIGGER deny_profile BEFORE INSERT ON athlete_profiles BEGIN SELECT RAISE(ABORT, 'denied'); END;`)
    const before = snapshot(db)
    assert.throws(() => provisionAcceptanceAthleteB({ db, actor, apply: true }), /denied/)
    assert.deepEqual(snapshot(db), before)
  } finally { db.close() }
})

test('KAN-782 subject collision denies without changing any user or membership', () => {
  const db = fixture()
  try {
    db.prepare('INSERT INTO external_identity_links(id,user_id,provider,subject) VALUES (?,?,?,?)')
      .run('existing-link','accept_h4b_athlete','supabase',actor.subject)
    const before = snapshot(db)
    assert.throws(() => provisionAcceptanceAthleteB({ db, actor, apply: true }), /incompatible/i)
    assert.deepEqual(snapshot(db), before)
  } finally { db.close() }
})
