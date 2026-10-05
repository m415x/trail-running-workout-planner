import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

import { migrateKan615Historical0015 } from './kan-615-historical-0015'
import { seedKan615PreservationData } from './kan-615-preservation-seed'
import {
  migrateAthleteProfileIdentitySqlite,
} from '../../db/migrations/athlete-profile-identity-sqlite'

function snapshot(sqlite: Database.Database) {
  const schema = sqlite.prepare(`
    SELECT type, name, tbl_name, sql
    FROM sqlite_master
    ORDER BY type, name
  `).all()

  const tables = sqlite.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table'
    ORDER BY name
  `).all() as Array<{ name: string }>

  return {
    schema,
    data: Object.fromEntries(tables.map(({ name }) => [
      name,
      sqlite.prepare(
        `SELECT * FROM "${name}" ORDER BY rowid`,
      ).all(),
    ])),
  }
}

test('KAN-615 refuses competing writer and restores connection state', () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'kan615-exclusive-'),
  )
  const databasePath = join(directory, 'scenario.sqlite')

  let owner: Database.Database | undefined
  let contender: Database.Database | undefined

  try {
    owner = new Database(databasePath)
    owner.pragma('foreign_keys = ON')

    migrateKan615Historical0015(owner)
    seedKan615PreservationData(owner)

    const before = snapshot(owner)
    assert.deepEqual(owner.pragma('foreign_key_check'), [])

    contender = new Database(databasePath, { timeout: 200 })
    contender.pragma('foreign_keys = ON')

    // An existing writer owns a RESERVED lock.
    owner.exec('BEGIN IMMEDIATE')

    try {
      assert.throws(
        () => migrateAthleteProfileIdentitySqlite(contender!),
        error =>
          error instanceof Error &&
          /database is locked|SQLITE_BUSY/i.test(
            `${error.message} ${String(
              (error as { code?: string }).code ?? '',
            )}`,
          ),
        'A competing writer must prevent the exclusive rebuild',
      )

      assert.equal(contender.inTransaction, false)

      assert.equal(
        contender.pragma('foreign_keys', { simple: true }),
        1,
        'Foreign keys must be restored after lock rejection',
      )

      // Read on the existing owner connection while its lock is held.
      assert.deepEqual(snapshot(owner), before)
    } finally {
      if (owner.inTransaction) owner.exec('ROLLBACK')
    }

    // With contention removed, the same contender must remain usable.
    assert.deepEqual(snapshot(contender), before)
    assert.deepEqual(contender.pragma('foreign_key_check'), [])

    migrateAthleteProfileIdentitySqlite(contender)

    assert.equal(contender.inTransaction, false)
    assert.equal(
      contender.pragma('foreign_keys', { simple: true }),
      1,
    )
    assert.deepEqual(contender.pragma('foreign_key_check'), [])

    const history = contender.prepare(`
      SELECT COUNT(*) AS count FROM __drizzle_migrations
    `).get() as { count: number }

    assert.equal(history.count, 17)
  } finally {
    if (contender?.open) contender.close()

    if (owner?.open) {
      if (owner.inTransaction) owner.exec('ROLLBACK')
      owner.close()
    }

    rmSync(directory, { recursive: true, force: true })
  }
})
