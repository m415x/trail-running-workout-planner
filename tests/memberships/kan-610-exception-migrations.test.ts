import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-730 exception author migrations are registered for SQLite and Supabase', () => {
  for (const [root, tag] of [
    ['drizzle/sqlite', '0022_h7a_exception_authors'],
    ['drizzle/supabase', '0035_h7a_exception_authors'],
  ]) {
    const path = root + '/' + tag + '.sql'
    assert.ok(existsSync(path), path + ' must exist')
    const sql = readFileSync(path, 'utf8')
    for (const table of ['global_monthly_due_date_exceptions', 'monthly_charge_reductions', 'monthly_charge_extensions']) {
      assert.ok(sql.includes(table), table + ' must be migrated')
    }
    assert.ok(sql.includes('created_by_user_id'), 'author column required')
    const journal = readFileSync(root + '/meta/_journal.json', 'utf8')
    assert.ok(journal.includes(tag), 'migration must be registered')
  }
})

test('KAN-730 migration snapshots include nullable author columns for all three exception tables', () => {
  for (const [root, tag] of [['drizzle/sqlite', '0022'], ['drizzle/supabase', '0035']]) {
    const path = root + '/meta/' + tag + '_snapshot.json'
    assert.ok(existsSync(path), path + ' must exist')
    const snapshot = readFileSync(path, 'utf8')
    for (const table of ['global_monthly_due_date_exceptions', 'monthly_charge_reductions', 'monthly_charge_extensions']) {
      assert.ok(snapshot.includes(table), table + ' must be represented in ' + path)
    }
    assert.ok(snapshot.includes('created_by_user_id'), 'snapshot must include author column')
  }
})
