import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-835 S3 RED: init seeds Team only and reruns safely', () => {
  const root = resolve(process.cwd())
  const workspace = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  const path = join(workspace, 'sqlite.db')
  const cli = resolve(root, 'node_modules/tsx/dist/cli.mjs')
  const env = { ...process.env, SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: path,
    SQLITE_SEED_DISPOSABLE_ACK: '1', TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json') }
  const run = (script: string) => spawnSync(process.execPath, [cli, resolve(root, script)],
    { cwd: workspace, env, encoding: 'utf8', timeout: 120000 })
  try {
    const migration = run('scripts/upgrade-sqlite.ts')
    assert.equal(migration.status, 0, `${migration.stdout}\n${migration.stderr}`)
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = run('db/seeds/init.ts')
      assert.equal(result.status, 0, `init failed: ${result.stdout}\n${result.stderr}`)
      const db = new Database(path, { readonly: true, fileMustExist: true })
      try {
        const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
        assert.ok(count('teams') > 0)
        for (const table of ['users', 'athlete_profiles', 'athlete_groups', 'group_training_plans', 'sessions', 'group_session_prescriptions'])
          assert.equal(count(table), 0, `init unexpectedly populated ${table}`)
        assert.deepEqual(db.pragma('foreign_key_check'), [])
      } finally { db.close() }
    }
  } finally { rmSync(workspace, { recursive: true, force: true }) }
})
