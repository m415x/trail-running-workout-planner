import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { assertAthleteProfileUpgradePreconditions } from '../../db/migrations/athlete-profile-identity-sqlite'

test('KAN-615 rejects an active transaction before any structural operation', () => {
  const sqlite = new Database(':memory:')

  try {
    sqlite.pragma('foreign_keys = ON')
    sqlite.exec('CREATE TABLE sentinel (id TEXT PRIMARY KEY)')
    sqlite.exec("INSERT INTO sentinel VALUES ('preserved')")

    sqlite.exec('BEGIN')

    try {
      assert.throws(
        () => assertAthleteProfileUpgradePreconditions(sqlite),
        /transaction|exclusive|precondition/i
      )

      assert.equal(sqlite.inTransaction, true)

      assert.deepEqual(
        sqlite.prepare('SELECT id FROM sentinel').all(),
        [{ id: 'preserved' }]
      )
    } finally {
      sqlite.exec('ROLLBACK')
    }
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects connections with foreign keys disabled', () => {
  const sqlite = new Database(':memory:')

  try {
    sqlite.pragma('foreign_keys = OFF')
    sqlite.exec('CREATE TABLE sentinel (id TEXT PRIMARY KEY)')
    sqlite.exec("INSERT INTO sentinel VALUES ('preserved')")

    assert.throws(
      () => assertAthleteProfileUpgradePreconditions(sqlite),
      /foreign.keys|precondition/i
    )

    assert.deepEqual(
      sqlite.prepare('SELECT id FROM sentinel').all(),
      [{ id: 'preserved' }]
    )
  } finally {
    sqlite.close()
  }
})
