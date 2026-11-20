import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import Database from 'better-sqlite3'

test('KAN-878 RED-6 detects missing or incompatible SQLite vertical prescription columns', async () => {
  const guardPath = fileURLToPath(new URL('../../scripts/vertical-prescription-sqlite-schema-guard.ts', import.meta.url))
  assert.equal(existsSync(guardPath), true, 'KAN-878 RED-6: vertical prescription physical schema guard is missing')
  const guardModule = await import(pathToFileURL(guardPath).href)
  const audit = Reflect.get(guardModule, 'auditVerticalPrescriptionSqliteSchema')
  assert.equal(typeof audit, 'function')

  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE group_session_prescriptions (
        id text PRIMARY KEY,
        session_id text NOT NULL,
        microcycle_id text NOT NULL,
        elevation_gain integer
      );
    `)

    assert.deepEqual(audit(sqlite).sort(), [
      'group_session_prescriptions.primary_objective must be nullable TEXT',
      'group_session_prescriptions.vertical_block_json must be nullable TEXT',
    ], 'Legacy physical schema must be identified as not yet at HEAD')

    sqlite.exec(`
      ALTER TABLE group_session_prescriptions ADD primary_objective text;
      ALTER TABLE group_session_prescriptions ADD vertical_block_json text;
    `)
    assert.deepEqual(audit(sqlite), [], 'Both nullable TEXT fields satisfy HEAD schema')

    sqlite.exec('DROP TABLE group_session_prescriptions')
    sqlite.exec(`
      CREATE TABLE group_session_prescriptions (
        id text PRIMARY KEY,
        primary_objective text NOT NULL,
        vertical_block_json integer
      );
    `)
    assert.deepEqual(audit(sqlite).sort(), [
      'group_session_prescriptions.primary_objective must be nullable TEXT',
      'group_session_prescriptions.vertical_block_json must be nullable TEXT',
    ], 'An incompatible type or NOT NULL drift must fail closed')
  } finally {
    sqlite.close()
  }
})
