import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { groupSessionPrescriptions } from '../../db/schema'
import { resolveVerticalPrescriptionEditFields } from '../../lib/sessions/session-vertical-edit-fields'
import { preflightVerticalSessionEdits } from '../../lib/sessions/session-vertical-edit-preflight'

const now = '2026-11-20T00:00:00Z'
const obsolete = JSON.stringify({
  schemaVersion: 1,
  direction: 'ascent',
  repetitions: 2,
  coverage: 'complete',
  elevationGainPerRep: { meters: 400, provenance: { kind: 'coach_manual' } },
  elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
})

test('KAN-879 RED-12 reactivating soft-deleted Session + microcycle never inherits obsolete vertical fields', () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE group_session_prescriptions (
        id TEXT PRIMARY KEY, session_id TEXT NOT NULL, group_id TEXT NOT NULL,
        microcycle_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0, distance_km REAL, duration_min INTEGER,
        elevation_gain INTEGER, primary_objective TEXT, vertical_block_json TEXT,
        intensity_method TEXT, zone TEXT, reference_percentage REAL, notes TEXT,
        generation_ownership TEXT NOT NULL DEFAULT 'manual', generation_key TEXT
      );
      CREATE UNIQUE INDEX prescription_unique ON group_session_prescriptions(session_id, microcycle_id);
    `)
    sqlite.prepare(`
      INSERT INTO group_session_prescriptions (
        id, session_id, group_id, microcycle_id, created_at, updated_at, is_deleted,
        elevation_gain, primary_objective, vertical_block_json
      ) VALUES ('prescription-old','session-a','group-a','week-a',?,?,1,800,'elevation_gain',?)
    `).run(now, now, obsolete)

    const db = drizzle(sqlite)
    const prior = db.select().from(groupSessionPrescriptions).all()
    const submitted = { microcycleId: 'week-a', elevationGain: 500, groupId: 'group-a' }
    const active = prior.filter(row => !row.isDeleted)

    assert.doesNotThrow(() => preflightVerticalSessionEdits({
      previous: active,
      edits: [submitted],
    }), 'A new legacy prescription must not validate against deleted obsolete vertical data')

    const fields = resolveVerticalPrescriptionEditFields({
      previous: active.find(row => row.microcycleId === submitted.microcycleId) ?? null,
    })
    assert.deepEqual(fields, { primaryObjective: null, verticalBlockJson: null },
      'Deleted row cannot supply inherited objective or vertical JSON')

    db.insert(groupSessionPrescriptions).values({
      id: 'new-id',
      sessionId: 'session-a',
      groupId: 'group-a',
      microcycleId: 'week-a',
      elevationGain: submitted.elevationGain,
      primaryObjective: fields.primaryObjective,
      verticalBlockJson: fields.verticalBlockJson,
      createdAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: [groupSessionPrescriptions.sessionId, groupSessionPrescriptions.microcycleId],
      set: {
        isDeleted: false,
        groupId: 'group-a',
        elevationGain: submitted.elevationGain,
        primaryObjective: fields.primaryObjective,
        verticalBlockJson: fields.verticalBlockJson,
        updatedAt: now,
      },
    }).run()

    const revived = db.select().from(groupSessionPrescriptions).all()
    assert.equal(revived.length, 1)
    assert.equal(revived[0].isDeleted, false)
    assert.equal(revived[0].elevationGain, 500)
    assert.equal(revived[0].primaryObjective, null)
    assert.equal(revived[0].verticalBlockJson, null,
      'The SQLite upsert must clear obsolete vertical data when a previously deleted scope is reused')
  } finally {
    sqlite.close()
  }
})

test('KAN-879 RED-12 updateSession excludes deleted prescriptions from previous-value preservation', () => {
  const source = readFileSync('app/actions/session-actions.ts', 'utf8')
  const begin = source.indexOf('export async function updateSession(')
  const end = source.indexOf('function validatePrescriptionReferences(', begin)
  assert.ok(begin >= 0 && end > begin)
  const update = source.slice(begin, end)
  assert.match(update,
    /const existingPrescriptions = db\.select\(\)\.from\(groupSessionPrescriptions\)[\s\S]*?\.where\(and\(eq\(groupSessionPrescriptions\.sessionId, sessionId\), eq\(groupSessionPrescriptions\.isDeleted, false\)\)\)\.all\(\)/,
    'Previous vertical objective, JSON, and generation ownership must come only from active prescriptions')
  assert.match(update, /previous:\s*existingPrescriptions\.map\(/,
    'The preflight must share the filtered active-row collection')
})
