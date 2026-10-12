import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'

const root = process.cwd()
const tsx = resolve(root, 'node_modules/tsx/dist/cli.mjs')
const script = 'scripts/recover-h7a-reviewer-sqlite.ts'

function command(path: string, args: string[] = []) {
  return spawnSync(process.execPath, [tsx, ...args, script, '--database', path], {
    cwd: root, encoding: 'utf8', env: { ...process.env, SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: path },
  })
}

function createDrift(sqlite: Database.Database) {
  const row = sqlite.prepare("SELECT sql FROM sqlite_master WHERE name = 'field_performance_tests'").get() as { sql: string }
  const lines = row.sql.split('\n')
  assert.ok(lines.some(line => line.includes('FOREIGN KEY (`reviewed_by_user_id`)')))
  const rebuilt = lines
    .filter(line => !line.includes('FOREIGN KEY (`reviewed_by_user_id`)'))
    .filter(line => !line.includes('`reviewed_by_user_id` text'))
    .join('\n')
    .replace(/CREATE TABLE [`"]field_performance_tests[`"]/, 'CREATE TABLE __kan757_field_performance_tests')
    .replaceAll('"field_performance_tests".', '')
    .replace(/,\s*\)/g, '\n)')
  const cols = (sqlite.pragma('table_info(field_performance_tests)') as Array<{ name: string }>)
    .map(row => row.name).filter(name => name !== 'reviewed_by_user_id')
    .map(name => '"' + name + '"').join(',')
  sqlite.pragma('foreign_keys = OFF')
  try {
    sqlite.transaction(() => {
      sqlite.exec(rebuilt)
      sqlite.exec('INSERT INTO __kan757_field_performance_tests (' + cols + ') SELECT ' + cols + ' FROM field_performance_tests')
      sqlite.exec('DROP TABLE field_performance_tests')
      sqlite.exec('ALTER TABLE __kan757_field_performance_tests RENAME TO field_performance_tests')
    })()
  } finally {
    sqlite.pragma('foreign_keys = ON')
  }
}

test('KAN-757 repair preserves rows, migration metadata and FK, reruns without changes, and rejects unexpected drift', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kan-757-recover-'))
  const path = join(dir, 'copy.sqlite')
  try {
    const upgrade = spawnSync(process.execPath, [tsx, 'scripts/upgrade-sqlite.ts'], {
      cwd: root, encoding: 'utf8',
      env: { ...process.env, SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: path },
    })
    assert.equal(upgrade.status, 0, upgrade.stderr || upgrade.stdout)

    const db = new Database(path)
    let before: unknown[]
    try {
      db.exec("INSERT INTO teams (id, name, created_at, updated_at, is_deleted) VALUES ('team-1','Team','2026-01-01','2026-01-01',0)")
      db.exec("INSERT INTO users (id,user_name,email,first_name,last_name,created_at,updated_at,is_deleted) VALUES ('user-1','test','test@example.test','T','E','2026-01-01','2026-01-01',0)")
      before = db.prepare('SELECT id, created_at, hash FROM __drizzle_migrations ORDER BY rowid').all()
      createDrift(db)
      assert.equal((db.pragma('table_info(field_performance_tests)') as Array<{ name: string }>).some(c => c.name === 'reviewed_by_user_id'), false)
    } finally { db.close() }

    const recovered = command(path)
    assert.equal(recovered.status, 0, recovered.stderr || recovered.stdout)
    const after = new Database(path, { readonly: true })
    let fingerprint: string
    try {
      assert.deepEqual(after.prepare('SELECT id, created_at, hash FROM __drizzle_migrations ORDER BY rowid').all(), before)
      assert.deepEqual(after.pragma('integrity_check'), [{ integrity_check: 'ok' }])
      assert.deepEqual(after.pragma('foreign_key_check'), [])
      assert.deepEqual(after.prepare('SELECT id FROM users').all(), [{ id: 'user-1' }])
      const fk = (after.pragma('foreign_key_list(field_performance_tests)') as Array<{ from: string; table: string; to: string; on_delete: string }>).find(fk => fk.from === 'reviewed_by_user_id')
      assert.deepEqual(fk && { table: fk.table, to: fk.to, on_delete: fk.on_delete }, { table: 'users', to: 'id', on_delete: 'RESTRICT' })
      fingerprint = JSON.stringify(after.prepare("SELECT sql FROM sqlite_master WHERE name = 'field_performance_tests'").get())
    } finally { after.close() }

    const again = command(path)
    assert.equal(again.status, 0, again.stderr || again.stdout)
    const rerun = new Database(path, { readonly: true })
    try { assert.equal(JSON.stringify(rerun.prepare("SELECT sql FROM sqlite_master WHERE name = 'field_performance_tests'").get()), fingerprint) }
    finally { rerun.close() }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
