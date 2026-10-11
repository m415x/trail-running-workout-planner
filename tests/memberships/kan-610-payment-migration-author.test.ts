import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-731 nullable payment author migrations exist and are journaled for both databases', () => {
  for (const [root, tag] of [
    ['drizzle/sqlite', '0023_h7a_payment_author'],
    ['drizzle/supabase', '0036_h7a_payment_author'],
  ]) {
    const journal = readFileSync(root + '/meta/_journal.json', 'utf8')
    assert.ok(journal.includes(tag), root + ' must register ' + tag)
    const migration = readFileSync(root + '/' + tag + '.sql', 'utf8')
    assert.match(migration, /payment_revisions/i)
    assert.match(migration, /created_by_user_id/i)
    assert.match(migration, /REFERENCES\s+users\s*\(\s*id\s*\)/i)
    assert.match(migration, /ON DELETE\s+restrict/i)
  }
})
