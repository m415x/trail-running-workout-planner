import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { getTableColumns, getTableName } from 'drizzle-orm'
import ts from 'typescript'
import { sessions, groupSessionPrescriptions } from '@/db/schema'
import { preflightVerticalSessionEdits } from '@/lib/sessions/session-vertical-edit-preflight'
import { writeVerticalBlockJson } from '@/lib/sessions/vertical-prescription-json'

test('KAN-862 T4 actual createSession transaction rolls back session if prescription insertion fails', () => {
  const sqlite = new Database(':memory:')
  try {
    const tables = [sessions, groupSessionPrescriptions]
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table))
      const definitions = columns.map(column => {
        const kind = column.dataType === 'number' || column.dataType === 'boolean' ? 'INTEGER' : 'TEXT'
        return `"${column.name}" ${kind}${column.name === 'id' ? ' PRIMARY KEY' : ''}`
      })
      sqlite.exec(`CREATE TABLE "${getTableName(table)}" (${definitions.join(', ')})`)
    }

    const snapshot = () => ({
      sessions: sqlite.prepare('SELECT * FROM sessions ORDER BY id').all(),
      prescriptions: sqlite.prepare('SELECT * FROM group_session_prescriptions ORDER BY id').all(),
    })
    const initial = snapshot()
    const source = readFileSync('app/actions/session-actions.ts', 'utf8')
    const actionStart = source.indexOf('export async function createSession(')
    const actionEnd = source.indexOf('export async function updateSession(', actionStart)
    const createAction = source.slice(actionStart, actionEnd)
    // Locate the production Drizzle transaction by syntax tree, not indentation:
    // createSession now wraps it in executeAuthorizedSessionMutation.
    const parsedSource = ts.createSourceFile('session-actions.ts', source, ts.ScriptTarget.Latest, true)
    const candidates: ts.CallExpression[] = []
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.getText(parsedSource) === 'db.transaction'
        && node.getStart(parsedSource) >= actionStart
        && node.getEnd() <= actionEnd) {
        candidates.push(node)
      }
      ts.forEachChild(node, visit)
    }
    visit(parsedSource)
    assert.equal(candidates.length, 1, 'createSession must have exactly one real transaction')
    const productionTransaction = candidates[0].getText(parsedSource)
    assert.match(productionTransaction, /tx\.insert\(sessions\)/)
    assert.match(productionTransaction, /tx\.insert\(groupSessionPrescriptions\)/)
    const compiled = ts.transpileModule(productionTransaction, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText

    const db = drizzle(sqlite)
    const context = {
      db, sessions, groupSessionPrescriptions, randomUUID,
      preflightVerticalSessionEdits, writeVerticalBlockJson,
      sessionId: 'session-team-b', now: '2026-11-02T12:00:00.000Z',
      planningAccess: { teamId: 'team-b' },
      data: {
        workoutId: null, date: '2026-11-04', title: 'Trail Team B', type: 'easy',
        locationKey: null, trackPath: null, notes: null,
      },
      structure: null,
      prescriptions: { data: [{
        groupId: 'group-b', microcycleId: 'micro-b',
        distanceKm: 9, durationMin: 60, elevationGain: 100,
        intensityMethod: null, zone: null, referencePercentage: null, notes: null,
        primaryObjective: 'elevation_gain',
        verticalBlock: {
          schemaVersion: 1, direction: 'ascent', repetitions: 2, coverage: 'complete',
          elevationGainPerRep: { meters: 50, provenance: { kind: 'coach_manual' } },
          elevationLossPerRep: { meters: null, provenance: { kind: 'unknown' } },
        },
      }] },
    }
    const runProductionTransaction = () => vm.runInNewContext(compiled, context)
    sqlite.exec(`
      CREATE TRIGGER inject_prescription_failure BEFORE INSERT ON group_session_prescriptions
      BEGIN SELECT RAISE(ABORT, 'injected prescription failure'); END;
    `)
    assert.throws(runProductionTransaction, /injected prescription failure/)
    assert.deepEqual(snapshot(), initial, 'session insertion must roll back with failed prescription')

    sqlite.exec('DROP TRIGGER inject_prescription_failure')
    runProductionTransaction()
    assert.equal((sqlite.prepare('SELECT count(*) AS n FROM sessions WHERE team_id = ?').get('team-b') as {n: number}).n, 1)
    assert.equal((sqlite.prepare('SELECT count(*) AS n FROM group_session_prescriptions').get() as {n: number}).n, 1)
    const saved = sqlite.prepare('SELECT primary_objective, vertical_block_json FROM group_session_prescriptions').get() as {
      primary_objective: string | null
      vertical_block_json: string | null
    }
    assert.equal(saved.primary_objective, 'elevation_gain')
    assert.equal(JSON.parse(saved.vertical_block_json ?? 'null').elevationGainPerRep.meters, 50)
  } finally {
    sqlite.close()
  }
})
