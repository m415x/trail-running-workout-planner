import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const realWriters = [
  'tests/realized-training/history-query.test.ts',
  'tests/realized-training/repository-timing.test.ts',
  'tests/realized-training/isolation.test.ts',
  'tests/readiness/durable-realized-training.test.ts',
]

test('KAN-684 legacy real-writer tests select their isolated SQLite explicitly', () => {
  for (const path of realWriters) {
    const source = readFileSync(path, 'utf8')
    assert.match(source, /SQLITE_SCENARIO_MODE/, `${path} must explicitly enable isolated DB mode`)
    assert.match(source, /SQLITE_DATABASE_PATH/, `${path} must supply its temporary database path`)
    assert.doesNotMatch(source, /process\.chdir\(/, `${path} must not depend on a process-global working directory change`)
  }
})
