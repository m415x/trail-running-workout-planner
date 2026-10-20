import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-837 S5 RED: demo preserves historical S2 effective fixture in isolated SQLite', () => {
  const root = resolve(process.cwd())
  const workspace = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  const path = join(workspace, 'sqlite.db')
  const cli = resolve(root, 'node_modules/tsx/dist/cli.mjs')
  const env = { ...process.env, SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: path,
    SQLITE_SEED_DISPOSABLE_ACK: '1', TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json') }
  const run = (file: string) => spawnSync(process.execPath, [cli, resolve(root, file)],
    { cwd: workspace, env, encoding: 'utf8', timeout: 120000 })
  try {
    const migration = run('scripts/upgrade-sqlite.ts')
    assert.equal(migration.status, 0, `migration failed: ${migration.stdout}\n${migration.stderr}`)
    const demo = run('db/seeds/demo.ts')
    assert.equal(demo.status, 0, `demo failed: ${demo.stdout}\n${demo.stderr}`)
    const db = new Database(path, { readonly: true, fileMustExist: true })
    try {
      const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
      assert.ok(count('athlete_groups') > 0)
      assert.ok(count('group_training_plans') > 0)
      assert.ok(count('sessions') > 0, 'demo must restore effective sessions absent from plan level')
      assert.ok(count('group_session_prescriptions') > 0, 'demo must preserve historical prescription fixtures')
      const shared = db.prepare('SELECT id FROM sessions WHERE id = ?').get('accept_h4b_shared_session') as { id: string } | undefined
      assert.ok(shared, 'historical H4B shared Session ID must remain stable')
      assert.deepEqual(db.pragma('foreign_key_check'), [])
    } finally { db.close() }
  } finally { rmSync(workspace, { recursive: true, force: true }) }
})
