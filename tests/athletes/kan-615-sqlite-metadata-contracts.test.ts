import assert from 'node:assert/strict'
import test from 'node:test'
import { migrateKan615Historical0015 } from './kan-615-historical-0015'
import Database from 'better-sqlite3'

import {
  assertAthleteProfileVersionedOriginSqlite,
} from '../../db/migrations/athlete-profile-identity-sqlite'

type MigrationRow = {
  hash: string
  created_at: number
}

function historicalOrigin(): Database.Database {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')

  try {
    migrateKan615Historical0015(sqlite)

    assert.equal(
      (sqlite.pragma('table_info(athlete_profiles)') as unknown[]).length,
      16,
    )

    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
    return sqlite
  } catch (error) {
    sqlite.close()
    throw error
  }
}

function installCanonicalIntegerMetadata(
  sqlite: Database.Database,
): void {
  const rows = sqlite.prepare(`
    SELECT hash, created_at
    FROM __drizzle_migrations
    ORDER BY rowid
  `).all() as MigrationRow[]

  assert.equal(rows.length, 16)

  sqlite.transaction(() => {
    sqlite.exec('DROP TABLE __drizzle_migrations')

    sqlite.exec(`
      CREATE TABLE __drizzle_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL,
        created_at NUMERIC
      )
    `)

    const insert = sqlite.prepare(`
      INSERT INTO __drizzle_migrations (hash, created_at)
      VALUES (?, ?)
    `)

    for (const row of rows) {
      insert.run(row.hash, row.created_at)
    }
  })()
}

test('KAN-615 accepts contract A: real Drizzle SERIAL metadata', () => {
  const sqlite = historicalOrigin()

  try {
    const ids = sqlite.prepare(`
      SELECT id FROM __drizzle_migrations ORDER BY rowid
    `).all() as Array<{ id: number | null }>

    assert.equal(ids.length, 16)
    assert.ok(ids.every(row => row.id === null))

    assertAthleteProfileVersionedOriginSqlite(sqlite)
  } finally {
    sqlite.close()
  }
})

test('KAN-615 accepts contract B: canonical INTEGER metadata', () => {
  const sqlite = historicalOrigin()

  try {
    installCanonicalIntegerMetadata(sqlite)

    const ids = sqlite.prepare(`
      SELECT id FROM __drizzle_migrations ORDER BY id
    `).all() as Array<{ id: number }>

    assert.deepEqual(
      ids.map(row => row.id),
      Array.from({ length: 16 }, (_, index) => index + 1),
    )

    assertAthleteProfileVersionedOriginSqlite(sqlite)
  } finally {
    sqlite.close()
  }
})

function expectMetadataRejection(sqlite: Database.Database): void {
  assert.throws(
    () => assertAthleteProfileVersionedOriginSqlite(sqlite),
    error =>
      error instanceof Error &&
      !(error instanceof TypeError) &&
      /AthleteProfile incompatible versioned origin/i.test(error.message),
    'Expected deliberate rejection of incompatible migration metadata',
  )
}

test('KAN-615 rejects SERIAL metadata with non-null identifier', () => {
  const sqlite = historicalOrigin()
  try {
    sqlite.exec(`
      UPDATE __drizzle_migrations
      SET id = 999
      WHERE rowid = (
        SELECT MIN(rowid) FROM __drizzle_migrations
      )
    `)
    expectMetadataRejection(sqlite)
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects modified canonical migration hash', () => {
  const sqlite = historicalOrigin()
  try {
    sqlite.exec(`
      UPDATE __drizzle_migrations
      SET hash = 'invalid-hash'
      WHERE rowid = (
        SELECT MAX(rowid) FROM __drizzle_migrations
      )
    `)
    expectMetadataRejection(sqlite)
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects incorrect canonical timestamp', () => {
  const sqlite = historicalOrigin()
  try {
    sqlite.exec(`
      UPDATE __drizzle_migrations
      SET created_at = created_at + 1
      WHERE rowid = (
        SELECT MAX(rowid) FROM __drizzle_migrations
      )
    `)
    expectMetadataRejection(sqlite)
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects an additional duplicate history row', () => {
  const sqlite = historicalOrigin()
  try {
    sqlite.exec(`
      INSERT INTO __drizzle_migrations (hash, created_at)
      SELECT hash, created_at
      FROM __drizzle_migrations
      WHERE rowid = (
        SELECT MIN(rowid) FROM __drizzle_migrations
      )
    `)
    expectMetadataRejection(sqlite)
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects reordered historical migrations', () => {
  const sqlite = historicalOrigin()
  try {
    const rows = sqlite.prepare(`
      SELECT rowid, hash, created_at
      FROM __drizzle_migrations
      ORDER BY rowid
      LIMIT 2
    `).all() as Array<{
      rowid: number
      hash: string
      created_at: number
    }>

    assert.equal(rows.length, 2)

    sqlite.transaction(() => {
      const update = sqlite.prepare(`
        UPDATE __drizzle_migrations
        SET hash = ?, created_at = ?
        WHERE rowid = ?
      `)

      update.run(rows[1].hash, rows[1].created_at, rows[0].rowid)
      update.run(rows[0].hash, rows[0].created_at, rows[1].rowid)
    })()

    expectMetadataRejection(sqlite)
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects unexpected migration metadata column', () => {
  const sqlite = historicalOrigin()
  try {
    sqlite.exec(`
      ALTER TABLE __drizzle_migrations
      ADD COLUMN unexpected_metadata TEXT
    `)
    expectMetadataRejection(sqlite)
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects invalid INTEGER metadata identifiers', () => {
  const sqlite = historicalOrigin()
  try {
    installCanonicalIntegerMetadata(sqlite)

    sqlite.exec(`
      UPDATE __drizzle_migrations
      SET id = 999
      WHERE id = 1
    `)

    expectMetadataRejection(sqlite)
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects additional metadata index', () => {
  const sqlite = historicalOrigin()

  try {
    sqlite.exec(`
      CREATE INDEX unexpected_migration_hash_idx
      ON __drizzle_migrations(hash)
    `)

    expectMetadataRejection(sqlite)
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects INTEGER metadata without AUTOINCREMENT', () => {
  const sqlite = historicalOrigin()

  try {
    const rows = sqlite.prepare(`
      SELECT hash, created_at
      FROM __drizzle_migrations
      ORDER BY rowid
    `).all() as MigrationRow[]

    sqlite.transaction(() => {
      sqlite.exec('DROP TABLE __drizzle_migrations')

      sqlite.exec(`
        CREATE TABLE __drizzle_migrations (
          id INTEGER PRIMARY KEY,
          hash TEXT NOT NULL,
          created_at NUMERIC
        )
      `)

      const insert = sqlite.prepare(`
        INSERT INTO __drizzle_migrations (hash, created_at)
        VALUES (?, ?)
      `)

      for (const row of rows) {
        insert.run(row.hash, row.created_at)
      }
    })()

    expectMetadataRejection(sqlite)
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects SERIAL metadata with extra UNIQUE constraint', () => {
  const sqlite = historicalOrigin()

  try {
    sqlite.exec(`
      CREATE UNIQUE INDEX unexpected_migration_timestamp_unique
      ON __drizzle_migrations(created_at)
    `)

    expectMetadataRejection(sqlite)
  } finally {
    sqlite.close()
  }
})

test('KAN-615 contracts A and B preserve identical application schema', () => {
  const sqlite = historicalOrigin()

  try {
    const applicationSchema = () => sqlite.prepare(`
      SELECT type, name, tbl_name, sql
      FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'
        AND name <> '__drizzle_migrations'
        AND tbl_name <> '__drizzle_migrations'
      ORDER BY type, name
    `).all()

    const history = () => sqlite.prepare(`
      SELECT hash, created_at
      FROM __drizzle_migrations
      ORDER BY rowid
    `).all()

    const incomingReferences = () => {
      const tables = sqlite.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
      `).all() as Array<{ name: string }>

      return tables.flatMap(({ name }) => {
        const safe = name.replace(/"/g, '""')
        const references = sqlite.pragma(
          `foreign_key_list("${safe}")`
        ) as Array<{
          table: string
          from: string
          to: string
          on_delete: string
          on_update: string
        }>

        return references
          .filter(reference => reference.table === 'athlete_profiles')
          .map(reference => ({
            source: name,
            from: reference.from,
            to: reference.to,
            onDelete: reference.on_delete,
            onUpdate: reference.on_update,
          }))
      }).sort((a, b) =>
        JSON.stringify(a).localeCompare(JSON.stringify(b))
      )
    }

    // Contrato A: origen histórico real generado por Drizzle.
    assertAthleteProfileVersionedOriginSqlite(sqlite)

    const schemaA = applicationSchema()
    const historyA = history()
    const referencesA = incomingReferences()

    assert.equal(referencesA.length, 12)

    // Contrato B: únicamente se representa el segundo formato
    // legítimo de metadatos en la base descartable.
    installCanonicalIntegerMetadata(sqlite)

    assertAthleteProfileVersionedOriginSqlite(sqlite)

    assert.deepEqual(applicationSchema(), schemaA)
    assert.deepEqual(history(), historyA)
    assert.deepEqual(incomingReferences(), referencesA)

    assert.equal(sqlite.pragma('foreign_keys', { simple: true }), 1)
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})
