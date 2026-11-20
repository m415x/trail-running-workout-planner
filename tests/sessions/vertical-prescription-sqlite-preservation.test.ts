import assert from 'node:assert/strict'
import { test } from 'node:test'
import Database from 'better-sqlite3'

test('KAN-878 RED-7 preservation scenario requires legacy vertical fields to remain SQL NULL', async () => {
  const verification = await import('../../scripts/verify-sqlite-scenarios')
  const assertPreservedVerticalFields = Reflect.get(verification, 'assertPreservedLegacyVerticalFields')

  assert.equal(
    typeof assertPreservedVerticalFields,
    'function',
    'KAN-878 RED-7: preservation scenario lacks a dedicated legacy vertical-fields assertion',
  )

  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE group_session_prescriptions (
        id text PRIMARY KEY NOT NULL,
        elevation_gain integer,
        primary_objective text,
        vertical_block_json text
      );
      INSERT INTO group_session_prescriptions
        (id, elevation_gain, primary_objective, vertical_block_json)
      VALUES ('legacy', 650, NULL, NULL);
    `)

    assert.doesNotThrow(
      () => assertPreservedVerticalFields(sqlite, 'legacy', 650),
      'A migrated legacy record retains its complete D+ and both optional fields NULL',
    )

    sqlite.prepare('UPDATE group_session_prescriptions SET primary_objective = ? WHERE id = ?')
      .run('distance', 'legacy')
    assert.throws(
      () => assertPreservedVerticalFields(sqlite, 'legacy', 650),
      /legacy|vertical|NULL|objective/i,
      'An inferred distance objective must be detected, not silently accepted',
    )

    sqlite.prepare('UPDATE group_session_prescriptions SET primary_objective = NULL, vertical_block_json = ? WHERE id = ?')
      .run('{}', 'legacy')
    assert.throws(
      () => assertPreservedVerticalFields(sqlite, 'legacy', 650),
      /legacy|vertical|NULL|block/i,
      'A fabricated vertical JSON block must be detected',
    )

    sqlite.prepare('UPDATE group_session_prescriptions SET vertical_block_json = NULL, elevation_gain = ? WHERE id = ?')
      .run(1300, 'legacy')
    assert.throws(
      () => assertPreservedVerticalFields(sqlite, 'legacy', 650),
      /legacy|vertical|elevation/i,
      'A doubled whole-session elevation must be detected',
    )
  } finally {
    sqlite.close()
  }
})
