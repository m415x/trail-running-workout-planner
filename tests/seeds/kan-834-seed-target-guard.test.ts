import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import Database from 'better-sqlite3'

test('KAN-834 S2 RED: seed denies a non-accredited existing SQLite target without mutation', () => {
  const projectRoot = resolve(process.cwd())
  const workspace = mkdtempSync(join(tmpdir(), 'kan-834-unaccredited-target-'))
  const sqlitePath = join(workspace, 'sqlite.db')
  const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    SQLITE_SCENARIO_MODE: '1',
    SQLITE_DATABASE_PATH: sqlitePath,
    TSX_TSCONFIG_PATH: resolve(projectRoot, 'tsconfig.json'),
  }
  const run = (file: string) => spawnSync(
    process.execPath,
    [tsxCli, resolve(projectRoot, file)],
    { cwd: workspace, env, encoding: 'utf8', timeout: 120000 },
  )

  try {
    const upgrade = run('scripts/upgrade-sqlite.ts')
    assert.equal(upgrade.status, 0, `temporary schema initialization failed: ${upgrade.error ?? ''}\n${upgrade.stdout}\n${upgrade.stderr}`)

    // An existing, migrated SQLite is not automatically an authorized disposable seed target.
    // This test NEVER points to repository sqlite.db or any acceptance database.
    const beforeDb = new Database(sqlitePath, { readonly: true, fileMustExist: true })
    let before: { teams: number; groups: number; sessions: number }
    try {
      const count = (table: string): number =>
        (beforeDb.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
      before = { teams: count('teams'), groups: count('athlete_groups'), sessions: count('sessions') }
      assert.deepEqual(before, { teams: 0, groups: 0, sessions: 0 })
    } finally {
      beforeDb.close()
    }

    const attemptedSeed = run('db/seed.ts')
    assert.equal(attemptedSeed.error, undefined, 'seed process must launch to exercise its target guard')
    assert.notEqual(attemptedSeed.status, 0, 'seed must deny existing target without explicit disposable accreditation')

    const afterDb = new Database(sqlitePath, { readonly: true, fileMustExist: true })
    try {
      const count = (table: string): number =>
        (afterDb.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
      assert.deepEqual({
        teams: count('teams'),
        groups: count('athlete_groups'),
        sessions: count('sessions'),
      }, before, 'denied seed must not mutate domain rows')
      assert.deepEqual(afterDb.pragma('foreign_key_check'), [])
    } finally {
      afterDb.close()
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
