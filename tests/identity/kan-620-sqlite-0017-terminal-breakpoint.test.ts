import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-620 SQLite migration 0017 has no terminal statement breakpoint', () => {
  const sql = readFileSync(
    'drizzle/sqlite/0017_natural_fabian_cortez.sql',
    'utf8',
  )

  assert.doesNotMatch(
    sql,
    /--> statement-breakpoint\s*$/,
    'terminal statement breakpoint creates an empty migration statement',
  )
})
