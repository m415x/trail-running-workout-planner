import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-729 terms migration retains unknown legacy authors and enforces FK RESTRICT', () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.pragma('foreign_keys = ON')
    sqlite.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE athlete_billing_terms (
        id TEXT PRIMARY KEY,
        athlete_id TEXT NOT NULL,
        effective_from TEXT NOT NULL,
        effective_until TEXT
      );
      INSERT INTO users(id) VALUES ('coach-h2');
      INSERT INTO athlete_billing_terms(id, athlete_id, effective_from)
        VALUES ('legacy-terms', 'athlete-a', '2026-01-01');
    `)
    const migration = readFileSync('drizzle/sqlite/0021_h7a_terms_author.sql', 'utf8')
    for (const statement of migration.split('--> statement-breakpoint')) {
      if (statement.trim()) sqlite.exec(statement)
    }
    const getAuthor = sqlite.prepare('SELECT created_by_user_id AS author FROM athlete_billing_terms WHERE id = ?')
    assert.deepEqual(getAuthor.get('legacy-terms'), { author: null })
    sqlite.prepare('UPDATE athlete_billing_terms SET created_by_user_id = ? WHERE id = ?')
      .run('coach-h2', 'legacy-terms')
    assert.throws(() => sqlite.prepare('DELETE FROM users WHERE id = ?').run('coach-h2'), /FOREIGN KEY/)
    assert.throws(() => sqlite.prepare('UPDATE athlete_billing_terms SET created_by_user_id = ? WHERE id = ?').run('invented-h2', 'legacy-terms'), /FOREIGN KEY/)
    assert.deepEqual(getAuthor.get('legacy-terms'), { author: 'coach-h2' }, 'failed FK write retains original author')
  } finally {
    sqlite.close()
  }
})
