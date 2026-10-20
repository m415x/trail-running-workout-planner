import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import Database from 'better-sqlite3'

// S2: SQLite destination safety must hold even when scenario mode is not enabled.
test('KAN-834 S2 RED: ordinary seed refuses an existing unaccredited SQLite without writes', () => {
  const root = resolve(process.cwd())
  const workspace = mkdtempSync(join(tmpdir(), 'kan-834-normal-mode-'))
  const path = join(workspace, 'sqlite.db')
  const tsx = resolve(root, 'node_modules/tsx/dist/cli.mjs')
  const baseEnv = {
    ...process.env,
    SQLITE_SCENARIO_MODE: '1',
    SQLITE_DATABASE_PATH: path,
    TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json'),
  }
  try {
    const migrate = spawnSync(process.execPath, [tsx, resolve(root, 'scripts/upgrade-sqlite.ts')], {
      cwd: workspace, env: baseEnv, encoding: 'utf8', timeout: 120000,
    })
    assert.equal(migrate.status, 0, `temporary migration failed: ${migrate.stdout}\n${migrate.stderr}`)

    const beforeDb = new Database(path, { readonly: true, fileMustExist: true })
    const before = (beforeDb.prepare('SELECT COUNT(*) AS n FROM teams').get() as { n: number }).n
    beforeDb.close()
    assert.equal(before, 0)

    // Run from disposable cwd with no scenario accreditation: legacy CLI would
    // silently target cwd/sqlite.db. This must fail closed before any mutation.
    const env = { ...process.env, NODE_ENV: 'test' as const, SQLITE_SCENARIO_MODE: '', SQLITE_DATABASE_PATH: '', SQLITE_SEED_DISPOSABLE_ACK: '' }
    const seeded = spawnSync(process.execPath, [tsx, resolve(root, 'db/seed.ts')], {
      cwd: workspace, env, encoding: 'utf8', timeout: 120000,
    })
    assert.equal(seeded.error, undefined)
    assert.notEqual(seeded.status, 0, 'unaccredited ordinary seed must refuse SQLite mutation')

    const afterDb = new Database(path, { readonly: true, fileMustExist: true })
    try {
      assert.equal((afterDb.prepare('SELECT COUNT(*) AS n FROM teams').get() as { n: number }).n, before)
      assert.deepEqual(afterDb.pragma('foreign_key_check'), [])
    } finally {
      afterDb.close()
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
