import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-731 payment H2 author snapshots preserve lineage and FK', () => {
  for (const [root, current, previous, table] of [
    ['drizzle/sqlite', '0023', '0022', 'payment_revisions'],
    ['drizzle/supabase', '0036', '0035', 'public.payment_revisions'],
  ]) {
    const before = JSON.parse(readFileSync(root + '/meta/' + previous + '_snapshot.json', 'utf8'))
    const after = JSON.parse(readFileSync(root + '/meta/' + current + '_snapshot.json', 'utf8'))
    assert.equal(after.prevId, before.id, root + ' must preserve lineage')
    const payment = after.tables[table]
    assert.ok(payment, root + ' must preserve payment table')
    assert.ok(payment.columns.created_by_user_id, root + ' must include author column')
    assert.equal(payment.columns.created_by_user_id.notNull, false, 'historical author must remain nullable')
    assert.ok(JSON.stringify(payment.foreignKeys).includes('created_by_user_id'), root + ' must retain author FK')
  }
})
