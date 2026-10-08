import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// KAN-681 RED is intentionally static: it must never load @/db or open sqlite.db.
test('KAN-681 SQLite DB boundary honors scenario path and refuses missing isolated path', () => {
  const source = readFileSync('db/index.ts', 'utf8')
  assert.match(source, /SQLITE_SCENARIO_MODE/, 'DB bootstrap must distinguish isolated scenario execution')
  assert.match(source, /SQLITE_DATABASE_PATH/, 'DB bootstrap must select an explicit isolated SQLite path')
  assert.match(source, /throw new Error\(/, 'Missing isolated path must fail closed before opening SQLite')
})
