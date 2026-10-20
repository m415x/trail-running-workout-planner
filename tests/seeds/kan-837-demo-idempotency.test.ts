import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-837 S5: demo rerun preserves historical row counts and H4B identity', () => {
  const root = resolve(process.cwd())
  const workspace = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  const path = join(workspace, 'sqlite.db')
  const cli = resolve(root, 'node_modules/tsx/dist/cli.mjs')
  const env = { ...process.env, SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: path,
    SQLITE_SEED_DISPOSABLE_ACK: '1', TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json') }
  const run = (file: string) => spawnSync(process.execPath, [cli, resolve(root, file)], {
    cwd: workspace, env, encoding: 'utf8', timeout: 120000,
  })
  try {
    const upgrade = run('scripts/upgrade-sqlite.ts')
    assert.equal(upgrade.status, 0, `migration failed: ${upgrade.stdout}\n${upgrade.stderr}`)
    const snapshot = () => {
      const db = new Database(path, { readonly: true, fileMustExist: true })
      try {
        const tables = ['teams', 'users', 'athlete_profiles', 'athlete_groups',
          'planning_cohorts', 'group_training_plans', 'macrocycles', 'mesocycles',
          'microcycles', 'sessions', 'group_session_prescriptions',
          'load_strategies', 'intensity_strategies']
        const counts = Object.fromEntries(tables.map(table => [
          table, (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n,
        ]))
        const ids = db.prepare("SELECT id FROM group_session_prescriptions WHERE session_id = 'accept_h4b_shared_session' ORDER BY id")
          .all() as Array<{ id: string }>
        assert.deepEqual(db.pragma('foreign_key_check'), [])
        return { counts, ids }
      } finally { db.close() }
    }
    const first = run('db/seeds/demo.ts')
    assert.equal(first.status, 0, `first demo failed: ${first.stdout}\n${first.stderr}`)
    const before = snapshot()
    assert.equal(before.ids.length, 2)
    const second = run('db/seeds/demo.ts')
    assert.equal(second.status, 0, `second demo failed: ${second.stdout}\n${second.stderr}`)
    assert.deepEqual(snapshot(), before, 'demo rerun must retain row counts and H4B prescription IDs')
  } finally { rmSync(workspace, { recursive: true, force: true }) }
})
