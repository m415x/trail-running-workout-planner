import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-732 nullable H2 reviewer migration is journaled for SQLite and Supabase', () => {
  for (const [root, tag] of [
    ['drizzle/sqlite', '0024_h7a_field_review_author'],
    ['drizzle/supabase', '0037_h7a_field_review_author'],
  ]) {
    const journal = readFileSync(root + '/meta/_journal.json', 'utf8')
    assert.ok(journal.includes(tag), root + ' must register migration')
    const sql = readFileSync(root + '/' + tag + '.sql', 'utf8')
    assert.match(sql, /field_performance_tests/i)
    assert.match(sql, /reviewed_by_user_id/i)
    assert.match(sql, /REFERENCES\s+["`]?users["`]?\s*\(\s*["`]?id["`]?\s*\)/i)
    assert.match(sql, /ON DELETE\s+restrict/i)
  }
})
