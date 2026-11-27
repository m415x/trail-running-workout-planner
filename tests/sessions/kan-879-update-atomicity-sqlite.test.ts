import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq, getTableColumns, getTableName } from 'drizzle-orm'
import ts from 'typescript'
import { sessions, groupSessionPrescriptions, sessionGenerationModificationRecords } from '@/db/schema'
import { preflightVerticalSessionEdits } from '@/lib/sessions/session-vertical-edit-preflight'
import { resolveVerticalPrescriptionEditFields, assertVerticalEditElevationConsistency } from '@/lib/sessions/session-vertical-edit-fields'
import { writeVerticalBlockJson } from '@/lib/sessions/vertical-prescription-json'
import type { VerticalBlockV1 } from '@/lib/sessions/vertical-prescription'

test('KAN-879 T3 actual update transaction preserves legacy vertical dose and rolls back Session, Prescription and audit after late audit failure', () => {
  const sqlite = new Database(':memory:')
  try {
    for (const table of [sessions, groupSessionPrescriptions, sessionGenerationModificationRecords]) {
      const definitions = Object.values(getTableColumns(table)).map(column =>
        `"${column.name}" ${column.dataType === 'number' || column.dataType === 'boolean' ? 'INTEGER' : 'TEXT'}${column.name === 'id' ? ' PRIMARY KEY' : ''}`,
      )
      sqlite.exec(`CREATE TABLE "${getTableName(table)}" (${definitions.join(', ')})`)
    }
    sqlite.exec('CREATE UNIQUE INDEX prescription_scope ON group_session_prescriptions(session_id, microcycle_id)')
    const block: VerticalBlockV1 = {
      schemaVersion: 1, direction: 'ascent', repetitions: 3, coverage: 'complete',
      elevationGainPerRep: { meters: 300, provenance: { kind: 'coach_manual' } },
      elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
    }
    const verticalBlockJson = writeVerticalBlockJson(block)
    const db = drizzle(sqlite)
    const now = '2026-11-27T12:00:00.000Z'
    const sessionId = 'session-a'
    sqlite.prepare("INSERT INTO sessions (id, team_id, title, generation_ownership, is_deleted) VALUES (?, 'team-a', 'Original', 'generated', 0)").run(sessionId)
    sqlite.prepare("INSERT INTO group_session_prescriptions (id, session_id, group_id, microcycle_id, elevation_gain, primary_objective, vertical_block_json, generation_ownership, is_deleted) VALUES ('prescription-a', ?, 'group-a', 'micro-a', 900, 'elevation_gain', ?, 'generated', 0)").run(sessionId, verticalBlockJson)
    const existingSession = db.select().from(sessions).where(eq(sessions.id, sessionId)).get()
    assert.ok(existingSession)
    const existingPrescriptions = db.select().from(groupSessionPrescriptions).where(eq(groupSessionPrescriptions.sessionId, sessionId)).all()
    const snapshot = () => ({
      sessions: sqlite.prepare('SELECT * FROM sessions ORDER BY id').all(),
      prescriptions: sqlite.prepare('SELECT * FROM group_session_prescriptions ORDER BY id').all(),
      audit: sqlite.prepare('SELECT * FROM session_generation_modification_records ORDER BY id').all(),
    })
    const before = snapshot()
    const source = readFileSync('app/actions/session-actions.ts', 'utf8')
    const parsed = ts.createSourceFile('session-actions.ts', source, ts.ScriptTarget.Latest, true)
    const start = source.indexOf('export async function updateSession(')
    const end = source.indexOf('function validatePrescriptionReferences(', start)
    const candidates: ts.CallExpression[] = []
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'db.transaction'
        && node.getStart(parsed) >= start && node.getEnd() <= end) candidates.push(node)
      ts.forEachChild(node, visit)
    }
    visit(parsed)
    assert.equal(candidates.length, 1)
    const compiled = ts.transpileModule(candidates[0].getText(parsed), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText
    const context = {
      db, eq, sessions, groupSessionPrescriptions, sessionGenerationModificationRecords,
      randomUUID, preflightVerticalSessionEdits, resolveVerticalPrescriptionEditFields,
      assertVerticalEditElevationConsistency, existingSession, existingPrescriptions,
      sessionId, now, planningAccess: { teamId: 'team-a', userId: 'coach-a' },
      prescriptionOwnership: new Map([['micro-a', 'generated_modified']]),
      auditPlans: [{ microcycleId: 'micro-a', planId: 'plan-a' }],
      planIdByMicrocycle: new Map([['micro-a', 'plan-a']]),
      data: { workoutId: null, date: '2026-11-27', title: 'Edited', type: 'easy', locationKey: null, trackPath: null, notes: 'Legacy edit' },
      structure: null,
      prescriptions: { data: [{
        groupId: 'group-a', microcycleId: 'micro-a', distanceKm: 9, durationMin: 60,
        elevationGain: 900, intensityMethod: null, zone: null, referencePercentage: null, notes: 'Legacy edit',
      }] },
    }
    const run = () => vm.runInNewContext(compiled, context)
    // Failure is deliberately after Session update, Session audit and prescription upsert.
    sqlite.exec(`CREATE TRIGGER inject_late_audit_failure BEFORE INSERT ON session_generation_modification_records
      WHEN NEW.prescription_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'injected late prescription audit failure'); END;`)
    assert.throws(run, /injected late prescription audit failure/)
    assert.deepEqual(snapshot(), before)
    sqlite.exec('DROP TRIGGER inject_late_audit_failure')
    run()
    const saved = db.select().from(groupSessionPrescriptions).get()
    assert.equal(saved?.verticalBlockJson, verticalBlockJson)
    assert.equal(saved?.primaryObjective, 'elevation_gain')
    assert.equal(saved?.elevationGain, 900)
    assert.equal(saved?.generationOwnership, 'generated_modified')
    assert.equal(saved?.isDeleted, false)
    assert.equal(db.select().from(sessions).get()?.title, 'Edited')
    const audit = db.select().from(sessionGenerationModificationRecords).all()
    assert.equal(audit.length, 2)
    assert.ok(audit.every(row => row.changedByUserId === 'coach-a' && row.action === 'manual_modified'))
    assert.equal(audit.find(row => row.prescriptionId === 'prescription-a')?.ownership, 'generated_modified')
  } finally {
    sqlite.close()
  }
})
