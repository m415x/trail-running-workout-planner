import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { provisionAcceptanceAthleteB } from '@/lib/acceptance/athlete-b-provisioning'

function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE teams (id TEXT PRIMARY KEY);
    CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL);
    CREATE TABLE external_identity_links (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      provider TEXT NOT NULL, subject TEXT NOT NULL, UNIQUE(provider,subject)
    );
    CREATE TABLE team_memberships (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      team_id TEXT NOT NULL REFERENCES teams(id), preset TEXT NOT NULL, is_active INTEGER NOT NULL
    );
    CREATE TABLE athlete_profiles (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      team_id TEXT NOT NULL REFERENCES teams(id), group_id TEXT NULL
    );
    INSERT INTO teams(id) VALUES ('team_1');
  `)
  return db
}

const actor = {
  userId: 'accept_athlete_b',
  profileId: 'accept_profile_athlete_b',
  linkId: 'accept_link_athlete_b',
  membershipId: 'accept_membership_athlete_b',
  subject: 'synthetic-subject-for-test-only',
}

test('KAN-781 transaction creates B in team_1 without group or business planning', () => {
  const db = fixture()
  try {
    assert.equal(provisionAcceptanceAthleteB({ db, actor, apply: true }), 'created')
    assert.deepEqual(db.prepare('SELECT id,team_id,group_id FROM athlete_profiles').get(), {
      id: actor.profileId, team_id: 'team_1', group_id: null,
    })
    assert.deepEqual(db.prepare('SELECT preset,team_id,is_active FROM team_memberships').get(), {
      preset: 'athlete', team_id: 'team_1', is_active: 1,
    })
    assert.deepEqual(db.prepare('SELECT provider,subject,user_id FROM external_identity_links').get(), {
      provider: 'supabase', subject: actor.subject, user_id: actor.userId,
    })
  } finally { db.close() }
})

test('KAN-781 preflight and dry run cannot write', () => {
  const db = fixture()
  try {
    assert.equal(provisionAcceptanceAthleteB({ db, actor, apply: false }), 'absent')
    assert.equal(db.prepare('SELECT count(*) AS n FROM users').get()?.n, 0)
  } finally { db.close() }
})

test('KAN-781 incompatible partial identity is fail-closed and never repaired', () => {
  const db = fixture()
  try {
    db.prepare('INSERT INTO users(id,email) VALUES (?,?)').run(actor.userId, 'existing@example.invalid')
    assert.throws(() => provisionAcceptanceAthleteB({ db, actor, apply: true }), /incompatible/i)
    assert.equal(db.prepare('SELECT count(*) AS n FROM team_memberships').get()?.n, 0)
    assert.equal(db.prepare('SELECT count(*) AS n FROM users').get()?.n, 1)
  } finally { db.close() }
})
