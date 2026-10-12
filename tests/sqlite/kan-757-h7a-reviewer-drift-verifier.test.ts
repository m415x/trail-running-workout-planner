import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'

const root = process.cwd()
const tsx = resolve(root, 'node_modules/tsx/dist/cli.mjs')

function execute(script: string, database: string) {
  return spawnSync(process.execPath, [tsx, script], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, SQLITE_SCENARIO_MODE: '1', SQLITE_DATABASE_PATH: database },
  })
}


function rebuildWithoutReviewerForeignKey(sqlite: Database.Database, includeColumn: boolean) {
  const original = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'field_performance_tests'").get() as { sql: string }
  // Replace just the reviewer's inline column/FK contract in the schema of a disposable test database.
  const column = /,?\\s*["`]?reviewed_by_user_id["`]?\\s+text\\s+REFERENCES\\s+["`]?users["`]?\\s*\\(["`]?id["`]?\\)\\s+ON\\s+DELETE\\s+RESTRICT/i
  assert.match(original.sql, column, 'fixture must start with canonical H7A reviewer FK')
  const replacement = includeColumn ? ', reviewed_by_user_id TEXT' : ''
  const rebuilt = original.sql.replace(column, replacement).replace(/CREATE TABLE\\s+["`]?field_performance_tests["`]?/i, 'CREATE TABLE __kan757_field_performance_tests')
  const columns = sqlite.pragma('table_info(field_performance_tests)') as Array<{ name: string }>
  const retained = columns.map(({ name }) => name).filter(name => includeColumn || name !== 'reviewed_by_user_id')
  const quoted = retained.map(name => '"' + name + '"').join(', ')
  sqlite.pragma('foreign_keys = OFF')
  try {
    sqlite.transaction(() => {
      sqlite.exec(rebuilt)
      sqlite.exec('INSERT INTO __kan757_field_performance_tests (' + quoted + ') SELECT ' + quoted + ' FROM field_performance_tests')
      sqlite.exec('DROP TABLE field_performance_tests')
      sqlite.exec('ALTER TABLE __kan757_field_performance_tests RENAME TO field_performance_tests')
    })()
  } finally {
    sqlite.pragma('foreign_keys = ON')
  }
}

test('KAN-757 SQLite HEAD verifier rejects canonical 0024 metadata with missing reviewer column', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kan-757-reviewer-drift-'))
  const database = join(directory, 'scenario.sqlite')
  try {
    const upgrade = execute('scripts/upgrade-sqlite.ts', database)
    assert.equal(upgrade.status, 0, upgrade.stderr || upgrade.stdout)
    const sqlite = new Database(database)
    try {
      const applied = sqlite.prepare('SELECT created_at FROM __drizzle_migrations WHERE created_at = 1791643008000').get()
      assert.ok(applied, 'canonical H7A 0024 migration metadata must remain recorded')
      rebuildWithoutReviewerForeignKey(sqlite, false)
      assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM __drizzle_migrations WHERE created_at = 1791643008000").get() !== undefined, true)
    } finally {
      sqlite.close()
    }

    const verification = execute('scripts/verify-sqlite.ts', database)
    assert.notEqual(verification.status, 0, '0024 metadata cannot hide missing physical reviewer column')
    assert.match(verification.stderr + verification.stdout, /reviewed_by_user_id/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('KAN-757 SQLite HEAD verifier rejects reviewer column without canonical users RESTRICT FK', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kan-757-reviewer-fk-drift-'))
  const database = join(directory, 'scenario.sqlite')
  try {
    const upgrade = execute('scripts/upgrade-sqlite.ts', database)
    assert.equal(upgrade.status, 0, upgrade.stderr || upgrade.stdout)
    const sqlite = new Database(database)
    try {
      rebuildWithoutReviewerForeignKey(sqlite, true)
    } finally {
      sqlite.close()
    }

    const verification = execute('scripts/verify-sqlite.ts', database)
    assert.notEqual(verification.status, 0, 'reviewer column without users(id) ON DELETE RESTRICT must fail')
    assert.match(verification.stderr + verification.stdout, /reviewed_by_user_id/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
