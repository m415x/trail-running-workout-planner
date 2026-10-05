import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import {
  assertAthleteProfileIncomingReferencesSqlite,
} from '../../db/migrations/athlete-profile-identity-sqlite'

type ForeignKey = {
  tableTo: string
  columnsFrom: string[]
  columnsTo: string[]
  onDelete: string
  onUpdate: string
}

const snapshot = JSON.parse(
  readFileSync('drizzle/sqlite/meta/0015_snapshot.json', 'utf8')
) as {
  tables: Record<string, {
    foreignKeys?: Record<string, ForeignKey>
  }>
}

const references = Object.entries(snapshot.tables).flatMap(
  ([table, definition]) =>
    Object.values(definition.foreignKeys ?? {})
      .filter(fk => fk.tableTo === 'athlete_profiles')
      .map(fk => ({ table, fk }))
)

function fixture(): Database.Database {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec('CREATE TABLE athlete_profiles (id TEXT PRIMARY KEY)')

  for (const { table, fk } of references) {
    assert.equal(fk.columnsFrom.length, 1)
    assert.deepEqual(fk.columnsTo, ['id'])

    sqlite.exec(`
      CREATE TABLE "${table}" (
        id TEXT PRIMARY KEY,
        "${fk.columnsFrom[0]}" TEXT
          REFERENCES athlete_profiles(id)
          ON DELETE ${fk.onDelete}
          ON UPDATE ${fk.onUpdate}
      )
    `)
  }

  return sqlite
}

test('KAN-615 recognizes all twelve historical incoming foreign keys', () => {
  assert.equal(references.length, 12)

  const sqlite = fixture()
  try {
    assertAthleteProfileIncomingReferencesSqlite(sqlite)
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects a missing dependent relation', () => {
  const sqlite = fixture()
  try {
    sqlite.exec('DROP TABLE workout_logs')

    assert.throws(
      () => assertAthleteProfileIncomingReferencesSqlite(sqlite),
      /foreign.key|reference|structure|incompatible|drift/i
    )
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects an unexpected incoming reference', () => {
  const sqlite = fixture()
  try {
    sqlite.exec(`
      CREATE TABLE unexpected_athlete_relation (
        id TEXT PRIMARY KEY,
        athlete_id TEXT REFERENCES athlete_profiles(id)
      )
    `)

    assert.throws(
      () => assertAthleteProfileIncomingReferencesSqlite(sqlite),
      /foreign.key|reference|structure|incompatible|drift/i
    )
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects changed incoming foreign key action', () => {
  const sqlite = fixture()

  try {
    const original = references.find(
      reference => reference.table === 'workout_logs'
    )
    assert.ok(original)

    sqlite.exec('DROP TABLE workout_logs')

    const changedAction =
      original.fk.onDelete.toLowerCase() === 'cascade'
        ? 'RESTRICT'
        : 'CASCADE'

    sqlite.exec(`
      CREATE TABLE workout_logs (
        id TEXT PRIMARY KEY,
        "${original.fk.columnsFrom[0]}" TEXT
          REFERENCES athlete_profiles(id)
          ON DELETE ${changedAction}
          ON UPDATE ${original.fk.onUpdate}
      )
    `)

    assert.throws(
      () => assertAthleteProfileIncomingReferencesSqlite(sqlite),
      /foreign.key|reference|incompatible|drift/i
    )

    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects changed incoming foreign key source column', () => {
  const sqlite = fixture()

  try {
    const original = references.find(
      reference => reference.table === 'workout_logs'
    )
    assert.ok(original)

    sqlite.exec('DROP TABLE workout_logs')

    sqlite.exec(`
      CREATE TABLE workout_logs (
        id TEXT PRIMARY KEY,
        wrong_athlete_id TEXT
          REFERENCES athlete_profiles(id)
          ON DELETE ${original.fk.onDelete}
          ON UPDATE ${original.fk.onUpdate}
      )
    `)

    assert.throws(
      () => assertAthleteProfileIncomingReferencesSqlite(sqlite),
      /foreign.key|reference|incompatible|drift/i
    )

    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})
