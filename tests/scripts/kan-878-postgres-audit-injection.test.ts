import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

test('KAN-878 RED-18 injected PostgreSQL audit failure does not invalidate a preexisting committed audit', () => {
  const source = readFileSync(
    resolve('tests/sessions/vertical-prescription-postgres-real-acceptance.test.ts'),
    'utf8',
  )

  assert.match(
    source,
    /SELECT action, ownership, previous_value, new_value, changed_by_user_id[\s\S]*?assert\.equal\(audit\.length, 1\)/,
    'The acceptance must establish one committed audit before failure injection',
  )
  assert.match(
    source,
    /ADD CONSTRAINT reject_vertical_audit CHECK \(false\) NOT VALID/i,
    'PostgreSQL CHECK(false) must be NOT VALID to preserve the existing audit row while rejecting subsequent INSERTs',
  )
  assert.match(source, /assert\.rejects\([\s\S]*?persistVerticalPrescriptionPostgres/)
  assert.match(source, /ROLLBACK restores D\+/)
  assert.match(source, /ROLLBACK preserves exactly one committed audit/)
})
