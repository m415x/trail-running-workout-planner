import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-732 TestEvent creator FK retention is migrated in SQLite and Supabase', () => {
  for (const [root, tag] of [
    ['drizzle/sqlite', '0025_h7a_test_event_author_retention'],
    ['drizzle/supabase', '0038_h7a_test_event_author_retention'],
  ]) {
    const journal = JSON.parse(readFileSync(root + '/meta/_journal.json', 'utf8'))
    assert.ok(journal.entries.some((entry: { tag: string }) => entry.tag === tag))
    const sql = readFileSync(root + '/' + tag + '.sql', 'utf8')
    assert.match(sql, /field_performance_test_events/i)
    assert.match(sql, /created_by_user_id/i)
    assert.match(sql, /ON DELETE\s+RESTRICT/i)
  }
})
