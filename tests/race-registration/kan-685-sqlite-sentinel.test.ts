import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

const developmentDatabase = resolve('sqlite.db')
const integrationTest = resolve('tests/race-registration/race-registration-repository.test.ts')

function fileFingerprint(path: string): string | null {
  if (!existsSync(path)) return null
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

test('KAN-685 detects a controlled SQLite sentinel mutation', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'kan-685-mutation-check-'))
  const sentinel = join(workspace, 'sqlite.db')
  try {
    writeFileSync(sentinel, 'unchanged sentinel fixture')
    const before = fileFingerprint(sentinel)
    assert.ok(before)
    writeFileSync(sentinel, 'deliberately altered sentinel fixture')
    assert.notEqual(fileFingerprint(sentinel), before, 'The sentinel must detect a simulated write')
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('KAN-685 repeated real repository integration does not mutate development SQLite', () => {
  const originalFingerprint = fileFingerprint(developmentDatabase)
  for (let run = 0; run < 2; run++) {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--test', '--test-reporter=tap', integrationTest],
      {
        cwd: resolve('.'),
        env: { ...process.env, SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: join(tmpdir(), 'kan-685-uninitialized-path.sqlite') },
        encoding: 'utf8',
        timeout: 180_000,
        maxBuffer: 8 * 1024 * 1024,
      },
    )
    assert.equal(result.error, undefined, `Integration child failed to execute on run ${run + 1}: ${result.error?.message}`)
    assert.equal(result.status, 0, `Integration run ${run + 1} failed:\n${result.stdout}\n${result.stderr}`)
    assert.equal(
      fileFingerprint(developmentDatabase),
      originalFingerprint,
      `Development SQLite changed during isolated integration run ${run + 1}`,
    )
  }
})
