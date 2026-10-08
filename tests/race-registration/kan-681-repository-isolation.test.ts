import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// Structural RED: intentionally do not import real repositories before isolation.
test('KAN-681 real race registration repository test provisions SQLite before imports', () => {
  const source = readFileSync('tests/race-registration/race-registration-repository.test.ts', 'utf8')
  assert.match(source, /SQLITE_SCENARIO_MODE/, 'Repository integration tests must opt into isolated SQLite')
  assert.match(source, /SQLITE_DATABASE_PATH/, 'Repository integration tests must pass an explicit temporary DB path')
  assert.match(source, /import\(['"]@\/lib\/race-catalog\/catalog-repository['"]\)/, 'Real repository must be imported dynamically only after setup')
  assert.match(source, /after\(/, 'Isolated SQLite must be removed at teardown')
})
