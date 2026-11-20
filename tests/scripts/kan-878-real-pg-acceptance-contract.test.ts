import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

test('KAN-878 RED-17 real PostgreSQL acceptance scenario is explicit and not a SQL-double PASS', () => {
  const path = resolve('tests/sessions/vertical-prescription-postgres-real-acceptance.test.ts')
  let source = ''
  try {
    source = readFileSync(path, 'utf8')
  } catch {
    assert.fail('KAN-878 RED-17: dedicated PostgreSQL real acceptance scenario is missing')
  }
  assert.match(source, /KAN878_PG_URL/, 'Dedicated acceptance must use its own environment')
  assert.match(source, /assertSafeKan878PostgresTarget/, 'Validate the exact PostgreSQL destination')
  assert.match(source, /postgres\(/, 'Must create a real PostgreSQL connection, not a SQL double')
  assert.match(source, /\.begin\(/, 'Must execute under a real postgres transaction')
  assert.match(source, /persistVerticalPrescriptionPostgres/, 'Exercise the real writer')
  assert.match(source, /readVerticalPrescriptionPostgres/, 'Exercise the real persisted reader')
  assert.match(source, /session_generation_modification_records/, 'Check actual persisted audit')
  assert.match(source, /(?:ROLLBACK|rollback|injected audit failure)/, 'Must exercise a forced rollback')
  assert.match(source, /(?:SKIP|skip|BLOCKED)/, 'Must distinguish unconfigured environment from real PASS')
})
