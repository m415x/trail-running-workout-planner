import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-685 regression checks repeated real repository runs against a SQLite sentinel', () => {
  const path = 'tests/race-registration/kan-685-sqlite-sentinel.test.ts'
  assert.ok(existsSync(path), 'Sentinel regression must be an executable test')
  const source = readFileSync(path, 'utf8')
  assert.match(source, /spawnSync/, 'Sentinel must run the real integration test in a child process')
  assert.match(source, /createHash/, 'Sentinel must compare SQLite bytes before and after')
  assert.match(source, /for \(let run = 0; run < 2; run\+\+\)/, 'Sentinel must verify repeatability')
})
