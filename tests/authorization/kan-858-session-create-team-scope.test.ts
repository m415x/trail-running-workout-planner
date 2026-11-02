import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

const source = readFileSync('app/actions/session-actions.ts', 'utf8')
const validatorStart = source.indexOf('function validatePrescriptionReferences(')
assert.ok(validatorStart >= 0, 'production prescription validator must exist')
const validator = source.slice(validatorStart)

test('KAN-858 T1 rejects legacy fixed team authority for a valid Team B group on disposable SQLite', () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE athlete_groups (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_active INTEGER NOT NULL, is_deleted INTEGER NOT NULL);
      CREATE TABLE sessions (id TEXT PRIMARY KEY, team_id TEXT NOT NULL);
      CREATE TABLE group_session_prescriptions (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, group_id TEXT NOT NULL);
      INSERT INTO athlete_groups VALUES ('group-b', 'team-b', 1, 0);
    `)

    const activeTeam = 'team-b' // H3 server-owned authority in this isolated scope witness
    const authorized = sqlite.prepare('SELECT 1 FROM athlete_groups WHERE id = ? AND team_id = ? AND is_active = 1 AND is_deleted = 0')
      .get('group-b', activeTeam)
    assert.ok(authorized, 'persisted Group belongs to the active Team B')

    // The actual production query in validatePrescriptionReferences currently filters on
    // CURRENT_TEAM_ID. Check its authority source before demonstrating the SQLite consequence.
    const groupLookup = validator.slice(0, validator.indexOf('groupCodes.set('))
    assert.match(groupLookup, /eq\(athleteGroups\.teamId,\s*teamId\)/,
      'prescription lookup must use the server-owned active Team, not a fixed Team')

    const matchingGroups = sqlite.prepare('SELECT id FROM athlete_groups WHERE id = ? AND team_id = ? AND is_active = 1 AND is_deleted = 0')
      .all('group-b', activeTeam)
    assert.equal(matchingGroups.length, 1)
    assert.equal((sqlite.prepare('SELECT count(*) AS n FROM sessions').get() as { n: number }).n, 0)
    assert.equal((sqlite.prepare('SELECT count(*) AS n FROM group_session_prescriptions').get() as { n: number }).n, 0)
  } finally {
    sqlite.close()
  }
})
