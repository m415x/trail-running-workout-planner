import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import Database from 'better-sqlite3'

test('KAN-878 RED-12 atomically persists authorized vertical values and before/after audit in SQLite', async () => {
  const modulePath = fileURLToPath(new URL('../../lib/sessions/vertical-prescription-sqlite-writer.ts', import.meta.url))
  const module = await import(pathToFileURL(modulePath).href).catch(() => ({}))
  const persist = Reflect.get(module, 'persistVerticalPrescriptionSqlite')
  assert.equal(typeof persist, 'function', 'KAN-878 RED-12: transactional vertical prescription writer is missing')

  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE group_session_prescriptions (
        id text PRIMARY KEY,
        session_id text NOT NULL,
        microcycle_id text NOT NULL,
        generation_ownership text NOT NULL DEFAULT 'manual',
        is_deleted integer NOT NULL DEFAULT 0,
        elevation_gain integer,
        primary_objective text,
        vertical_block_json text,
        updated_at text NOT NULL
      );
      CREATE UNIQUE INDEX group_session_prescriptions_session_microcycle_unique
        ON group_session_prescriptions(session_id, microcycle_id);
      CREATE TABLE session_generation_modification_records (
        id text PRIMARY KEY,
        group_training_plan_id text NOT NULL,
        session_id text NOT NULL,
        prescription_id text NOT NULL,
        action text NOT NULL,
        ownership text NOT NULL,
        generation_key text,
        previous_value text,
        new_value text,
        changed_by_user_id text NOT NULL,
        created_at text NOT NULL,
        updated_at text NOT NULL
      );
      INSERT INTO group_session_prescriptions (
        id, session_id, microcycle_id, elevation_gain, updated_at
      ) VALUES ('prescription-a', 'session-a', 'microcycle-a', 650, '2026-11-19T00:00:00Z');
    `)

    const block = {
      schemaVersion: 1,
      direction: 'ascent',
      repetitions: 2,
      coverage: 'complete',
      elevationGainPerRep: { meters: 400, provenance: { kind: 'coach_manual' } },
      elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
    }
    const command = {
      sessionId: 'session-a',
      microcycleId: 'microcycle-a',
      planId: 'plan-a',
      userId: 'coach-a',
      now: '2026-11-20T00:00:00Z',
      authorized: true,
      primaryObjective: 'elevation_gain',
      elevationGain: 800,
      verticalBlock: block,
    }

    assert.equal(persist(sqlite, command), 'updated')
    const saved = sqlite.prepare(`
      SELECT elevation_gain, primary_objective, vertical_block_json
      FROM group_session_prescriptions WHERE id = 'prescription-a'
    `).get() as { elevation_gain: number; primary_objective: string; vertical_block_json: string }
    assert.equal(saved.elevation_gain, 800)
    assert.equal(saved.primary_objective, 'elevation_gain')
    assert.deepEqual(JSON.parse(saved.vertical_block_json), block)

    const audit = sqlite.prepare(`
      SELECT group_training_plan_id, session_id, prescription_id, action, ownership,
             previous_value, new_value, changed_by_user_id
      FROM session_generation_modification_records
    `).all() as Array<Record<string, unknown>>
    assert.equal(audit.length, 1)
    assert.equal(audit[0].action, 'manual_modified')
    assert.equal(audit[0].ownership, 'manual')
    assert.equal(audit[0].group_training_plan_id, 'plan-a')
    assert.equal(audit[0].changed_by_user_id, 'coach-a')
    const before = JSON.parse(audit[0].previous_value as string)
    const after = JSON.parse(audit[0].new_value as string)
    assert.deepEqual(before, { elevationGain: 650, primaryObjective: null, verticalBlockJson: null })
    assert.deepEqual(after, {
      elevationGain: 800,
      primaryObjective: 'elevation_gain',
      verticalBlockJson: saved.vertical_block_json,
    })

    assert.equal(persist(sqlite, command), 'unchanged', 'Identical replay must be idempotent')
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM session_generation_modification_records').get().n, 1)

    assert.throws(() => persist(sqlite, { ...command, authorized: false, elevationGain: 900 }), /authoriz|denied|forbidden/i)
    assert.equal(sqlite.prepare('SELECT elevation_gain FROM group_session_prescriptions').get().elevation_gain, 800)

    sqlite.exec(`
      CREATE TRIGGER reject_vertical_audit BEFORE INSERT ON session_generation_modification_records
      BEGIN SELECT RAISE(ABORT, 'audit injection failure'); END;
    `)
    assert.throws(() => persist(sqlite, { ...command, elevationGain: 900, verticalBlock: {
      ...block,
      coverage: 'partial',
    } }), /audit injection failure/)
    assert.equal(sqlite.prepare('SELECT elevation_gain FROM group_session_prescriptions').get().elevation_gain, 800,
      'Audit failure must rollback prescription mutation')
  } finally {
    sqlite.close()
  }
})
