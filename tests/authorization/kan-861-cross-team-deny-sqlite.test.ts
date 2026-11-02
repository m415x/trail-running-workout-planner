import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { executeAuthorizedSessionMutation } from '@/lib/sessions/authorized-session-mutation'

test('KAN-861 T3 cross-Team and revoked membership deny before any durable mutation', async () => {
  const sql = new Database(':memory:')
  try {
    sql.exec(`
      CREATE TABLE groups (id TEXT PRIMARY KEY, team_id TEXT NOT NULL);
      CREATE TABLE grants (user_id TEXT NOT NULL, group_id TEXT NOT NULL, active INTEGER NOT NULL);
      CREATE TABLE sessions (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, title TEXT NOT NULL);
      CREATE TABLE prescriptions (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, group_id TEXT NOT NULL);
      CREATE TABLE audit (id TEXT PRIMARY KEY, session_id TEXT NOT NULL);
      INSERT INTO groups VALUES ('b-old','team-b'),('b-new','team-b'),('a-foreign','team_1');
      INSERT INTO grants VALUES ('coach-b','b-old',1),('coach-b','b-new',1),('coach-b','a-foreign',1);
      INSERT INTO sessions VALUES ('session-b','team-b','original');
      INSERT INTO prescriptions VALUES ('p-old','session-b','b-old');
    `)

    const snapshot = () => ({
      sessions: sql.prepare('SELECT * FROM sessions ORDER BY id').all(),
      prescriptions: sql.prepare('SELECT * FROM prescriptions ORDER BY id').all(),
      audit: sql.prepare('SELECT * FROM audit ORDER BY id').all(),
    })
    const initial = snapshot()
    const serverTeamId = 'team-b'
    let mutations = 0
    const authorizeGroup = async (groupId: string) => Boolean(sql.prepare(`
      SELECT 1 FROM groups AS g
      JOIN grants AS m ON m.group_id = g.id
      WHERE g.id = ? AND g.team_id = ? AND m.user_id = ? AND m.active = 1
    `).get(groupId, serverTeamId, 'coach-b'))

    const attempt = async (existingGroupIds: string[], resultingGroupIds: string[]) =>
      executeAuthorizedSessionMutation({
        existingGroupIds, resultingGroupIds, authorizeGroup,
        mutate: () => {
          mutations++
          sql.transaction(() => {
            sql.prepare('UPDATE sessions SET title = ? WHERE id = ?').run('changed', 'session-b')
            sql.prepare('DELETE FROM prescriptions').run()
            sql.prepare('INSERT INTO prescriptions VALUES (?, ?, ?)').run('p-new', 'session-b', 'b-new')
            sql.prepare('INSERT INTO audit VALUES (?, ?)').run('audit-new', 'session-b')
          })()
        },
      })

    assert.equal(await attempt(['b-old'], ['b-new', 'a-foreign']), false,
      'a client-supplied foreign group cannot expand server Team scope')
    assert.equal(mutations, 0)
    assert.deepEqual(snapshot(), initial)

    sql.prepare('UPDATE grants SET active = 0 WHERE user_id = ? AND group_id = ?').run('coach-b', 'b-old')
    assert.equal(await attempt(['b-old'], ['b-new']), false,
      'revoked authority over the previous group prevents editing')
    assert.equal(mutations, 0)
    assert.deepEqual(snapshot(), initial)

    sql.prepare('UPDATE grants SET active = 1 WHERE user_id = ? AND group_id = ?').run('coach-b', 'b-old')
    assert.equal(await attempt(['b-old'], ['b-new']), true)
    assert.equal(mutations, 1)
    assert.notDeepEqual(snapshot(), initial)
  } finally {
    sql.close()
  }
})
