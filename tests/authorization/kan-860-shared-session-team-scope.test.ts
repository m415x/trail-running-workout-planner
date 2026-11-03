import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { executeAuthorizedSessionMutation } from '@/lib/sessions/authorized-session-mutation'

test('KAN-860 T2 covers previous and resulting group ownership before mutation', async () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec([
      'CREATE TABLE groups (id TEXT PRIMARY KEY, team_id TEXT NOT NULL)',
      'CREATE TABLE sessions (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, title TEXT NOT NULL)',
      'CREATE TABLE prescriptions (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, group_id TEXT NOT NULL)',
      "INSERT INTO groups VALUES ('previous-b','team-b'),('result-b','team-b'),('foreign-a','team_1')",
      "INSERT INTO sessions VALUES ('session-b','team-b','before')",
      "INSERT INTO prescriptions VALUES ('old','session-b','previous-b')",
    ].join(';') + ';')

    const snapshot = () => ({
      sessions: sqlite.prepare('SELECT * FROM sessions').all(),
      prescriptions: sqlite.prepare('SELECT * FROM prescriptions ORDER BY id').all(),
    })
    const before = snapshot()
    const belongsToB = async (id: string) =>
      Boolean(sqlite.prepare('SELECT id FROM groups WHERE id = ? AND team_id = ?').get(id, 'team-b'))

    let writes = 0
    const denied = await executeAuthorizedSessionMutation({
      existingGroupIds: ['previous-b'],
      resultingGroupIds: ['foreign-a'],
      authorizeGroup: belongsToB,
      mutate: () => { writes++ },
    })
    assert.equal(denied, false)
    assert.equal(writes, 0)
    assert.deepEqual(snapshot(), before)

    const seen: string[] = []
    const accepted = await executeAuthorizedSessionMutation({
      existingGroupIds: ['previous-b'],
      resultingGroupIds: ['result-b'],
      authorizeGroup: async id => { seen.push(id); return belongsToB(id) },
      mutate: () => sqlite.transaction(() => {
        sqlite.prepare('UPDATE sessions SET title = ? WHERE id = ?').run('after', 'session-b')
        sqlite.prepare('DELETE FROM prescriptions WHERE session_id = ?').run('session-b')
        sqlite.prepare('INSERT INTO prescriptions VALUES (?, ?, ?)').run('new', 'session-b', 'result-b')
      })(),
    })
    assert.equal(accepted, true)
    assert.deepEqual(seen, ['previous-b', 'result-b'])
    assert.equal((sqlite.prepare('SELECT title FROM sessions').get() as { title: string }).title, 'after')
    assert.equal((sqlite.prepare('SELECT group_id FROM prescriptions').get() as { group_id: string }).group_id, 'result-b')
  } finally {
    sqlite.close()
  }
})
