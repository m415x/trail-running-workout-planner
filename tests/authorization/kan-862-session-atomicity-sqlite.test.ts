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
    const transactionStart = createAction.indexOf('db.transaction((tx) => {')
    const transactionEnd = createAction.indexOf('\n    })', transactionStart)
    assert.ok(transactionStart >= 0 && transactionEnd > transactionStart, 'real create writer transaction must exist')
    const productionTransaction = createAction.slice(transactionStart, transactionEnd + '\n    })'.length)
    const compiled = ts.transpileModule(productionTransaction, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText

    const db = drizzle(sqlite)
    const context = {
      db, sessions, groupSessionPrescriptions, randomUUID,
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
  } finally {
    sqlite.close()
  }
})
