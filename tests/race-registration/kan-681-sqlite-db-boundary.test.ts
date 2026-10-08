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

test('KAN-681 scenario path cannot point at the developer SQLite database', () => {
  const source = readFileSync('db/index.ts', 'utf8')
  assert.match(source, /resolve\(/, 'Scenario path must be normalized before use')
  assert.match(source, /SQLITE_DATABASE_PATH[\s\S]*sqlite\.db/, 'Scenario bootstrap must explicitly reject the developer SQLite path')
})

test('KAN-681 Node test processes cannot silently use the development SQLite fallback', () => {
  const source = readFileSync('db/index.ts', 'utf8')
  assert.match(source, /NODE_TEST_CONTEXT/, 'Shared DB bootstrap must recognize Node test runner context')
  assert.match(source, /scenarioMode\s*\|\|/, 'Node test runner must require isolated DB selection even without scenario opt-in')
})
