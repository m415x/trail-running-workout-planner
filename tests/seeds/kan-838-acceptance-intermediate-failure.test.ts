import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-838 S6: H4B collision after staged demo never publishes partial acceptance', () => {
  const root = resolve(process.cwd())
  const workspace = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  const dbPath = join(workspace, 'sqlite.db')
  const cli = resolve(root, 'node_modules/tsx/dist/cli.mjs')
  const env: NodeJS.ProcessEnv = {
    ...process.env, NODE_ENV: 'test', CI: 'false',
    SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: dbPath,
    SQLITE_SEED_DISPOSABLE_ACK: '1', TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json'),
  }
  const run = (script: string) => spawnSync(process.execPath, [cli, resolve(root, script)], {
    cwd: workspace, env, encoding: 'utf8', timeout: 120000,
  })
  const snapshot = () => {
    const sqlite = new Database(dbPath, { readonly: true, fileMustExist: true })
    try {
      const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name: string }>
      return tables.map(({ name }) => ({
        name, rows: sqlite.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}" ORDER BY rowid`).all(),
      }))
    } finally { sqlite.close() }
  }
  try {
    const migration = run('scripts/upgrade-sqlite.ts')
    assert.equal(migration.status, 0, `migration failed: ${migration.stdout}\n${migration.stderr}`)
    // Force a legitimate collision in H4B's existing identity validation.
    // The demo phase can succeed, but actor provisioning must reject this user.
    const sqlite = new Database(dbPath, { fileMustExist: true })
    try {
      sqlite.prepare("INSERT INTO users (id, user_name, email, first_name, last_name) VALUES (?, ?, ?, ?, ?)")
        .run('collision_other_user', 'collision.other', 'athlete@test.com', 'Collision', 'Control')
    } finally { sqlite.close() }
    const before = snapshot()
    const failed = run('scripts/seed-acceptance-disposable.ts')
    assert.notEqual(failed.status, null, 'orchestrator process must run')
    assert.notEqual(failed.status, 0, 'H4B identity collision must reject acceptance')
    assert.match(`${failed.stdout}\n${failed.stderr}`, /Identity collision for athlete/,
      'the causal failure must arise in H4B after staging demo, not from infrastructure')
    assert.deepEqual(snapshot(), before, 'target SQLite must remain unchanged after intermediate failure')
  } finally { rmSync(workspace, { recursive: true, force: true }) }
})
