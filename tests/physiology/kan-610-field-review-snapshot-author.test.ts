import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-732 reviewer snapshots preserve lineage and nullable FK', () => {
  for (const [root, prior, current, tableName] of [
    ['drizzle/sqlite', '0023', '0024', 'field_performance_tests'],
    ['drizzle/supabase', '0036', '0037', 'public.field_performance_tests'],
  ]) {
    const before = JSON.parse(readFileSync(root + '/meta/' + prior + '_snapshot.json', 'utf8'))
    const after = JSON.parse(readFileSync(root + '/meta/' + current + '_snapshot.json', 'utf8'))
    assert.equal(after.prevId, before.id)
    const table = after.tables[tableName]
    assert.ok(table.columns.reviewed_by_user_id)
    assert.equal(table.columns.reviewed_by_user_id.notNull, false)
    assert.ok(JSON.stringify(table.foreignKeys).includes('reviewed_by_user_id'))
  }
})
