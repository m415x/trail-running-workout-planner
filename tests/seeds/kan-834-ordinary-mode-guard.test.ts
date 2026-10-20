import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import Database from 'better-sqlite3'

// Snapshot all durable SQLite tables and rows, not just Team counts. A rejected
// seed must leave identities, groups, plans, sessions and migration metadata intact.
function snapshotSqlite(path: string): string {
  const sqlite = new Database(path, { readonly: true, fileMustExist: true })
  try {
    const tables = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).all() as Array<{ name: string }>
    const state = tables.map(({ name }) => {
      const quoted = '"' + name.replaceAll('"', '""') + '"'
      return {
        name,
        rows: sqlite.prepare(`SELECT * FROM ${quoted} ORDER BY rowid`).all(),
      }
    })
    return JSON.stringify(state)
  } finally {
    sqlite.close()
  }
}

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

    const before = snapshotSqlite(path)
    const empty = new Database(path, { readonly: true, fileMustExist: true })
    try {
      assert.equal((empty.prepare('SELECT COUNT(*) AS n FROM teams').get() as { n: number }).n, 0)
    } finally {
      empty.close()
    }

    // Run from disposable cwd with no scenario accreditation: legacy CLI would
    // silently target cwd/sqlite.db. This must fail closed before any mutation.
    const env = { ...process.env, NODE_ENV: 'test' as const, TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json'), SQLITE_SCENARIO_MODE: '', SQLITE_DATABASE_PATH: '', SQLITE_SEED_DISPOSABLE_ACK: '' }
    const seeded = spawnSync(process.execPath, [tsx, resolve(root, 'db/seed.ts')], {
      cwd: workspace, env, encoding: 'utf8', timeout: 120000,
    })
    assert.equal(seeded.error, undefined, 'seed process must launch')
    const output = `${seeded.stdout ?? ''}\n${seeded.stderr ?? ''}`
    assert.notEqual(seeded.status, 0, `unaccredited seed must be denied; output:\n${output}`)
    assert.match(
      output,
      /KAN-834: seed destination is not explicitly accredited as disposable/,
      `reject only for the documented target-accreditation guard, not infrastructure: \n${output}`,
    )
    assert.equal(snapshotSqlite(path), before, 'denied seed must preserve all durable tables and rows')

    const afterDb = new Database(path, { readonly: true, fileMustExist: true })
    try {
      assert.deepEqual(afterDb.pragma('foreign_key_check'), [])
    } finally {
      afterDb.close()
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
