import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

const CONFIG = 'RACE_CATALOG_GLOBAL_MAINTAINER_USER_IDS'

/** Real writer, fresh canonical SQLite, no request/session, no network fixture. */
test('KAN-873 anonymous catalog create denies before durable mutation', async () => {
  const root = process.cwd()
  const dir = mkdtempSync(join(tmpdir(), 'kan-873-action-'))
  const target = join(dir, 'sqlite.db')
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    SQLITE_SCENARIO_MODE: '1',
    SQLITE_SEED_DISPOSABLE_ACK: '1',
    SQLITE_DATABASE_PATH: target,
    TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json'),
    EPT_IDENTITY_BACKEND: 'sqlite',
  }
  delete env[CONFIG]

  function run(args: string[]) {
    const result = spawnSync(process.execPath, args, {
      cwd: root, env, encoding: 'utf8', windowsHide: true,
      timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
    })
    if (result.error) throw result.error
    assert.equal(result.status, 0, `Fixture or action runtime failed: ${result.stderr.slice(-2000)}`)
    return result.stdout
  }

  function snapshot() {
    const sqlite = new Database(target, { readonly: true, fileMustExist: true })
    try {
      assert.equal(sqlite.pragma('integrity_check', { simple: true }), 'ok')
      assert.equal((sqlite.pragma('foreign_key_check') as unknown[]).length, 0)
      return sqlite.prepare('SELECT * FROM race_events ORDER BY id').all()
    } finally {
      sqlite.close()
    }
  }

  try {
    run(['--import', 'tsx', resolve(root, 'scripts/upgrade-sqlite.ts')])
    const before = snapshot()
    assert.equal(before.length, 0, 'Expected clean canonical catalog')
    const output = run(['--import', 'tsx', resolve(root, 'tests/race-catalog/kan-873-action-probe.ts')])
    const after = snapshot()
    const marker = output.split(/\r?\n/).find(line => line.startsWith('KAN873_RESULT:'))
    assert.ok(marker, 'Action did not report an outcome')
    const outcome = JSON.parse(marker.slice('KAN873_RESULT:'.length)) as {
      invoked: boolean; returned: boolean; error: unknown
    }
    assert.equal(outcome.invoked, true)
    assert.deepEqual(after, before, 'RED: anonymous call changed persisted race_events without global authorization')
    assert.equal(outcome.returned, true, 'An arbitrary exception is not an authorization denial')
    assert.equal(outcome.error, 'forbidden', 'Expected explicit authorization DENY')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
