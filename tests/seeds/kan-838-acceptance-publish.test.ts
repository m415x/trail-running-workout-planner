import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-838 acceptance publishes demo and H4B together on one disposable SQLite', () => {
  const root = resolve(process.cwd())
  const workspace = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  const sqlitePath = join(workspace, 'sqlite.db')
  const cli = resolve(root, 'node_modules/tsx/dist/cli.mjs')
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'test', CI: 'false',
    SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: sqlitePath,
    SQLITE_SEED_DISPOSABLE_ACK: '1', TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json') }
  const run = (script: string, overrides: NodeJS.ProcessEnv = env) => spawnSync(process.execPath,
    [cli, resolve(root, script)], { cwd: workspace, env: overrides, encoding: 'utf8', timeout: 120000 })
  const snapshot = () => {
    const db = new Database(sqlitePath, { readonly: true, fileMustExist: true })
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name: string }>
      return tables.map(({ name }) => ({
        name, rows: db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all(),
      }))
    } finally { db.close() }
  }
  try {
    const migrated = run('scripts/upgrade-sqlite.ts')
    assert.equal(migrated.status, 0, `migration failed: ${migrated.stdout}\n${migrated.stderr}`)
    const before = snapshot()
    const denied = run('scripts/seed-acceptance-disposable.ts', { ...env, SQLITE_SEED_DISPOSABLE_ACK: '0' })
    assert.notEqual(denied.status, null)
    assert.notEqual(denied.status, 0)
    assert.match(`${denied.stdout}\n${denied.stderr}`, /KAN-834: isolated seed target is not explicitly accredited as disposable/)
    assert.deepEqual(snapshot(), before, 'DENY must not publish any fixture')

    const accepted = run('scripts/seed-acceptance-disposable.ts')
    assert.equal(accepted.status, 0, `acceptance failed: ${accepted.stdout}\n${accepted.stderr}`)
    const db = new Database(sqlitePath, { readonly: true, fileMustExist: true })
    try {
      const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
      assert.ok(count('sessions') > 0)
      const rows = db.prepare("SELECT group_id FROM group_session_prescriptions WHERE session_id = 'accept_h4b_shared_session' ORDER BY group_id")
        .all() as Array<{ group_id: string }>
      assert.deepEqual(rows.map(row => row.group_id), ['team_1_M1', 'team_1_S2'])
      const actors = db.prepare("SELECT preset FROM team_memberships WHERE user_id LIKE 'accept_h4b_%' ORDER BY preset")
        .all() as Array<{ preset: string }>
      assert.deepEqual(actors.map(row => row.preset), ['admin', 'assistant', 'athlete', 'coach'])
      assert.deepEqual(db.pragma('foreign_key_check'), [])
    } finally { db.close() }
  } finally { rmSync(workspace, { recursive: true, force: true }) }
})
