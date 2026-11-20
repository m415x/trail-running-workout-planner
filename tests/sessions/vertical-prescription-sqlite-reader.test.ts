import assert from 'node:assert/strict'
import { test } from 'node:test'
import Database from 'better-sqlite3'

test('KAN-878 RED-11 reads vertical prescription by Session + microcycle without normalizing legacy or invalid JSON', async () => {
  const reader = await import('../../lib/sessions/vertical-prescription-json')
  const storage = await import('../../lib/sessions/vertical-prescription-sqlite-reader').catch(() => ({}))
  const read = Reflect.get(storage, 'readVerticalPrescriptionSqlite')

  assert.equal(typeof read, 'function', 'KAN-878 RED-11: a scoped SQLite vertical prescription reader is missing')

  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE group_session_prescriptions (
        id text PRIMARY KEY,
        session_id text NOT NULL,
        microcycle_id text NOT NULL,
        is_deleted integer NOT NULL DEFAULT 0,
        elevation_gain integer,
        primary_objective text,
        vertical_block_json text
      );
      CREATE UNIQUE INDEX group_session_prescriptions_session_microcycle_unique
        ON group_session_prescriptions(session_id, microcycle_id);
      INSERT INTO group_session_prescriptions
        (id, session_id, microcycle_id, elevation_gain)
      VALUES ('legacy', 'session-a', 'microcycle-a', 650);
    `)

    const scopeA = { sessionId: 'session-a', microcycleId: 'microcycle-a' }
    assert.deepEqual(read(sqlite, scopeA), {
      status: 'found',
      prescriptionId: 'legacy',
      primaryObjective: null,
      elevationGain: 650,
      verticalBlock: { status: 'absent' },
    }, 'Legacy primary objective and block must remain absent instead of inferred')

    assert.deepEqual(read(sqlite, { sessionId: 'session-a', microcycleId: 'microcycle-b' }), {
      status: 'not_found',
    }, 'A different microcycle must never resolve the same Session prescription')

    const block = {
      schemaVersion: 1,
      direction: 'ascent',
      repetitions: 2,
      coverage: 'complete',
      elevationGainPerRep: { meters: 400, provenance: { kind: 'coach_manual' } },
      elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
    }
    const encoded = reader.writeVerticalBlockJson(block as Parameters<typeof reader.writeVerticalBlockJson>[0])
    sqlite.prepare(`
      UPDATE group_session_prescriptions
      SET primary_objective = 'elevation_gain', elevation_gain = 800, vertical_block_json = ?
      WHERE id = 'legacy'
    `).run(encoded)
    assert.deepEqual(read(sqlite, scopeA), {
      status: 'found',
      prescriptionId: 'legacy',
      primaryObjective: 'elevation_gain',
      elevationGain: 800,
      verticalBlock: { status: 'valid', block },
    }, 'Stored optional values must round-trip without recomputing D+')

    sqlite.prepare('UPDATE group_session_prescriptions SET vertical_block_json = ? WHERE id = ?')
      .run(JSON.stringify({ ...block, schemaVersion: 2 }), 'legacy')
    assert.deepEqual(read(sqlite, scopeA).verticalBlock, { status: 'unsupported', schemaVersion: 2 })

    sqlite.prepare('UPDATE group_session_prescriptions SET vertical_block_json = ? WHERE id = ?')
      .run('{not json', 'legacy')
    assert.deepEqual(read(sqlite, scopeA).verticalBlock, { status: 'corrupt' })

    sqlite.prepare('UPDATE group_session_prescriptions SET is_deleted = 1 WHERE id = ?').run('legacy')
    assert.deepEqual(read(sqlite, scopeA), { status: 'not_found' }, 'Soft-deleted prescriptions remain invisible')
  } finally {
    sqlite.close()
  }
})
