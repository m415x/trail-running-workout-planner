import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-732 TestEvent creator retention snapshots preserve lineage and FK', () => {
  for (const [root, previous, current, tableName] of [
    ['drizzle/sqlite', '0024', '0025', 'field_performance_test_events'],
    ['drizzle/supabase', '0037', '0038', 'public.field_performance_test_events'],
  ]) {
    const before = JSON.parse(readFileSync(root + '/meta/' + previous + '_snapshot.json', 'utf8'))
    const after = JSON.parse(readFileSync(root + '/meta/' + current + '_snapshot.json', 'utf8'))
    assert.equal(after.prevId, before.id)
    const table = after.tables[tableName] ?? after.tables.field_performance_test_events
    assert.ok(table)
    assert.equal(table.columns.created_by_user_id.notNull, false)
    const fks = Object.values(table.foreignKeys) as Array<{ columnsFrom: string[]; tableTo: string; onDelete: string }>
    assert.ok(fks.some(fk => fk.columnsFrom.includes('created_by_user_id') && fk.tableTo === 'users' && fk.onDelete === 'restrict'))
  }
})
