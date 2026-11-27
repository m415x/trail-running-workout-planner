import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { assertAcceptancePhysicalSchema } from '@/scripts/acceptance-dev-physical-schema'

function withMemoryDatabase(run: (sqlite: Database.Database) => void): void {
  const sqlite = new Database(':memory:')
  try {
    run(sqlite)
  } finally {
    sqlite.close()
  }
}

test('KAN-885/T2 physical preflight rejects a structurally incomplete SQLite schema without creating tables', () => {
  withMemoryDatabase(sqlite => {
    sqlite.pragma('query_only = ON')
    const before = sqlite.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all()
    assert.throws(
      () => assertAcceptancePhysicalSchema(sqlite),
      /schema|physical|table|missing|structure|esquema/i,
    )
    assert.deepEqual(
      sqlite.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all(),
      before,
    )
  })
})

test('KAN-885/T2 physical preflight rejects incomplete H1 identity columns without modifying schema', () => {
  withMemoryDatabase(sqlite => {
    sqlite.exec('CREATE TABLE users (id TEXT PRIMARY KEY)')
    sqlite.exec('CREATE TABLE external_identity_links (user_id TEXT, provider TEXT)')
    sqlite.exec('CREATE TABLE team_memberships (user_id TEXT, team_id TEXT)')
    sqlite.pragma('query_only = ON')
    const before = sqlite.prepare(
      "SELECT name, sql FROM sqlite_schema WHERE type = 'table' ORDER BY name",
    ).all()
    assert.throws(
      () => assertAcceptancePhysicalSchema(sqlite),
      /schema|physical|column|table|missing|structure|esquema/i,
    )
    assert.deepEqual(
      sqlite.prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'table' ORDER BY name").all(),
      before,
    )
  })
})
