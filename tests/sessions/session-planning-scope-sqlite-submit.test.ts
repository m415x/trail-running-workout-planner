import assert from 'node:assert/strict'
import { it } from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'

import { groupSessionPrescriptions } from '@/db/schema'
import { parseSessionPrescriptions } from '@/lib/sessions/session-prescription-parser'
import { validateSessionMicrocyclePrescriptions } from '@/lib/sessions/session-microcycle-integration'

const sessionDate = '2026-09-23'
const candidates = {
  group_a: [
    { id: 'base_week', startDate: '2026-09-21', endDate: '2026-09-27' },
    { id: 'variant_week', startDate: '2026-09-21', endDate: '2026-09-27' },
  ],
}
const now = '2026-10-01T00:00:00Z'

function submitted(scopes: Array<{ id: string; km: string; method: string; zone?: string; percentage?: string }>) {
  const form = new FormData()
  for (const scope of scopes) {
    form.append('prescriptionMicrocycleId', scope.id)
    form.set(`prescriptionGroupId:${scope.id}`, 'group_a')
    form.set(`distanceKm:${scope.id}`, scope.km)
    form.set(`intensityMethod:${scope.id}`, scope.method)
    if (scope.zone) form.set(`zone:${scope.id}`, scope.zone)
    if (scope.percentage) form.set(`referencePercentage:${scope.id}`, scope.percentage)
  }
  const result = parseSessionPrescriptions(form)
  assert.equal(result.success, true)
  assert.equal(validateSessionMicrocyclePrescriptions(sessionDate, result.data, candidates), null)
  return result.data
}

it('persists and updates Base and Variant as independent Session + microcycle rows; single scope still works', () => {
  const sqlite = new Database(':memory:')
  try {
    // Minimal physical projection of the already-authoritative group_session_prescriptions schema.
    sqlite.exec(`
      CREATE TABLE group_session_prescriptions (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        session_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        microcycle_id TEXT NOT NULL,
        distance_km REAL,
        duration_min INTEGER,
        elevation_gain INTEGER,
        intensity_method TEXT,
        zone TEXT,
        reference_percentage REAL,
        notes TEXT,
        generation_ownership TEXT NOT NULL DEFAULT 'manual',
        generation_key TEXT
      );
      CREATE UNIQUE INDEX group_session_prescriptions_session_microcycle_unique
        ON group_session_prescriptions(session_id, microcycle_id);
    `)
    const db = drizzle(sqlite)
    const first = submitted([
      { id: 'base_week', km: '14', method: 'hr_zone', zone: 'Z2' },
      { id: 'variant_week', km: '7', method: 'reference_percentage', percentage: '90' },
    ])
    db.insert(groupSessionPrescriptions).values(first.map((row, index) => ({
      id: `prescription-${index}`, sessionId: 'session-1', ...row,
      createdAt: now, updatedAt: now,
    }))).run()

    const read = () => db.select().from(groupSessionPrescriptions)
      .where(eq(groupSessionPrescriptions.sessionId, 'session-1')).all()
      .sort((left, right) => left.microcycleId.localeCompare(right.microcycleId))
    assert.deepEqual(read().map((row) => [row.microcycleId, row.groupId, row.distanceKm, row.intensityMethod, row.zone, row.referencePercentage]), [
      ['base_week', 'group_a', 14, 'hr_zone', 'Z2', null],
      ['variant_week', 'group_a', 7, 'reference_percentage', null, 90],
    ])

    // Same upsert target and values construction as updateSession.
    const revised = submitted([
      { id: 'base_week', km: '16', method: 'hr_zone', zone: 'Z3' },
      { id: 'variant_week', km: '6', method: 'reference_percentage', percentage: '80' },
    ])
    for (const [index, row] of revised.entries()) {
      db.insert(groupSessionPrescriptions).values({
        id: `update-${index}`, sessionId: 'session-1', ...row,
        createdAt: now, updatedAt: now,
      }).onConflictDoUpdate({
        target: [groupSessionPrescriptions.sessionId, groupSessionPrescriptions.microcycleId],
        set: { ...row, isDeleted: false, updatedAt: now },
      }).run()
    }
    assert.deepEqual(read().map((row) => [row.microcycleId, row.distanceKm, row.zone, row.referencePercentage]), [
      ['base_week', 16, 'Z3', null],
      ['variant_week', 6, null, 80],
    ])

    const single = submitted([{ id: 'base_week', km: '9', method: 'hr_zone', zone: 'Z1' }])
    assert.equal(single.length, 1)
    assert.equal(single[0].microcycleId, 'base_week')
  } finally {
    sqlite.close()
  }
})
