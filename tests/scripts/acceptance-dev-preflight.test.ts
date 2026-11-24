import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

import { preflightAcceptanceSqlite } from '@/scripts/acceptance-dev-preflight'

const projectRoot = resolve(import.meta.dirname, '../..')

test('KAN-885/T2 preflight rejects developer sqlite.db before opening or creating it', () => {
  const developerDb = join(projectRoot, 'sqlite.db')
  const existedBefore = existsSync(developerDb)
  assert.throws(
    () => preflightAcceptanceSqlite({ databasePath: developerDb, projectRoot }),
    /development|developer|forbidden|prohibited|accredit|acreditad/i,
  )
  assert.equal(existsSync(developerDb), existedBefore)
})

test('KAN-885/T2 preflight fails closed on invalid physical schema without altering disposable DB', () => {
  const directory = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  const path = join(directory, 'acceptance.db')
  try {
    const setup = new Database(path)
    try {
      setup.exec('CREATE TABLE witness (id TEXT PRIMARY KEY)')
      setup.prepare('INSERT INTO witness (id) VALUES (?)').run('original')
    } finally {
      setup.close()
    }

    const before = readFileSync(path)
    assert.throws(
      () => preflightAcceptanceSqlite({ databasePath: path, projectRoot }),
      /physical|schema|table|missing|structure/i,
    )
    assert.deepEqual(readFileSync(path), before)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
