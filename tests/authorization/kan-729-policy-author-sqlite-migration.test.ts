import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-729 SQLite policy author migration preserves legacy rows and enforces FK RESTRICT', () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.pragma('foreign_keys = ON')
    sqlite.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE team_economic_policies (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        effective_from TEXT NOT NULL,
        effective_until TEXT
      );
      INSERT INTO users(id) VALUES ('coach-1');
      INSERT INTO team_economic_policies(id, team_id, effective_from)
      VALUES ('legacy', 'team-1', '2026-01-01');
    `)
    const sql = readFileSync('drizzle/sqlite/0020_h7a_policy_author.sql', 'utf8')
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) sqlite.exec(statement)
    }
    const legacy = sqlite.prepare('SELECT created_by_user_id FROM team_economic_policies WHERE id = ?').get('legacy') as { created_by_user_id: string | null }
    assert.equal(legacy.created_by_user_id, null, 'legacy authors remain unknown')
    sqlite.prepare('UPDATE team_economic_policies SET created_by_user_id = ? WHERE id = ?').run('coach-1', 'legacy')
    assert.throws(() => sqlite.prepare('DELETE FROM users WHERE id = ?').run('coach-1'), /FOREIGN KEY/)
    assert.throws(() => sqlite.prepare('UPDATE team_economic_policies SET created_by_user_id = ? WHERE id = ?').run('spoofed-missing', 'legacy'), /FOREIGN KEY/)
  } finally {
    sqlite.close()
  }
})
