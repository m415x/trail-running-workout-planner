import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

import { openAcceptanceSqliteReadonly } from '@/scripts/acceptance-dev-readonly'

function withDisposableDirectory(run: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  try {
    run(directory)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

test('KAN-885/T2 physical SQLite opener preserves a real existing file and forbids writes', () => {
  withDisposableDirectory(directory => {
    const path = join(directory, 'acceptance.db')
    const setup = new Database(path)
    try {
      setup.exec('CREATE TABLE witness (id TEXT PRIMARY KEY)')
      setup.prepare('INSERT INTO witness (id) VALUES (?)').run('original')
    } finally {
      setup.close()
    }

    const before = readFileSync(path)
    const sqlite = openAcceptanceSqliteReadonly(path)
    try {
      assert.equal(sqlite.pragma('query_only', { simple: true }), 1)
      assert.deepEqual(sqlite.prepare('SELECT id FROM witness').all(), [{ id: 'original' }])
      assert.throws(
        () => sqlite.prepare('INSERT INTO witness (id) VALUES (?)').run('forbidden'),
        /read.only|readonly|query.only|readonly database|attempt to write/i,
      )
    } finally {
      sqlite.close()
    }
    assert.deepEqual(readFileSync(path), before)
  })
})

test('KAN-885/T2 physical SQLite opener rejects missing file without creating it', () => {
  withDisposableDirectory(directory => {
    const missing = join(directory, 'missing.db')
    assert.equal(existsSync(missing), false)
    assert.throws(
      () => openAcceptanceSqliteReadonly(missing),
      /exist|missing|not found|unable to open|open database|file/i,
    )
    assert.equal(existsSync(missing), false)
  })
})
