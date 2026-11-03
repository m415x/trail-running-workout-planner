import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { and, eq, getTableColumns, getTableName } from 'drizzle-orm'
import ts from 'typescript'
import * as schema from '@/db/schema'
import { validateSessionMicrocyclePrescriptions } from '@/lib/sessions/session-microcycle-integration'

test('KAN-858 T1 production prescription boundary accepts persisted Team B references', () => {
  const sqlite = new Database(':memory:')
  try {
    const tables = [
      schema.athleteGroups,
      schema.groupTrainingPlans,
      schema.macrocycles,
      schema.mesocycles,
      schema.microcycles,
      schema.sessions,
      schema.groupSessionPrescriptions,
    ]
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table))
      const definitions = columns.map(column => {
        const kind = column.dataType === 'number' || column.dataType === 'boolean' ? 'INTEGER' : 'TEXT'
        return `"${column.name}" ${kind}${column.name === 'id' ? ' PRIMARY KEY' : ''}`
      })
      sqlite.exec(`CREATE TABLE "${getTableName(table)}" (${definitions.join(', ')})`)
    }

    const insert = (table: string, fields: Record<string, string | number>) => {
      const keys = Object.keys(fields)
      sqlite.prepare(`INSERT INTO "${table}" (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
        .run(...Object.values(fields))
    }
    insert('athlete_groups', {
      id: 'group-b', team_id: 'team-b', category_code: 'S', level_code: '2', is_active: 1, is_deleted: 0,
    })
    insert('group_training_plans', { id: 'plan-b', group_id: 'group-b', is_deleted: 0 })
    insert('macrocycles', { id: 'macro-b', group_training_plan_id: 'plan-b', is_deleted: 0 })
    insert('mesocycles', { id: 'meso-b', macrocycle_id: 'macro-b', is_deleted: 0 })
    insert('microcycles', {
      id: 'micro-b', mesocycle_id: 'meso-b', start_date: '2026-11-02',
      end_date: '2026-11-08', is_deleted: 0,
    })

    const activeTeam = 'team-b'
    assert.ok(sqlite.prepare('SELECT id FROM athlete_groups WHERE id=? AND team_id=? AND is_active=1 AND is_deleted=0')
      .get('group-b', activeTeam), 'persisted Sporting Group must belong to authorized Team B')
    assert.ok(sqlite.prepare('SELECT id FROM microcycles WHERE id=?').get('micro-b'), 'microcycle fixture exists')
    assert.equal((sqlite.prepare('SELECT count(*) AS n FROM sessions').get() as { n: number }).n, 0)

    // Execute the unmodified production validator body with real Drizzle/SQLite.
    // This isolates the production boundary without booting Next, Supabase or HTTP.
    const source = readFileSync('app/actions/session-actions.ts', 'utf8')
    const start = source.indexOf('function validatePrescriptionReferences(')
    assert.ok(start >= 0)
    const productionFunction = source.slice(start)
    const compiled = ts.transpileModule(
      productionFunction + '\n globalThis.__actualValidator = validatePrescriptionReferences',
      { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
    ).outputText
    const context = {
      db: drizzle(sqlite, { schema }),
      athleteGroups: schema.athleteGroups,
      groupTrainingPlans: schema.groupTrainingPlans,
      macrocycles: schema.macrocycles,
      mesocycles: schema.mesocycles,
      microcycles: schema.microcycles,
      CURRENT_TEAM_ID: 'team_1',
      and,
      eq,
      validateSessionMicrocyclePrescriptions,
      __actualValidator: undefined as undefined | ((rows: unknown[], date: string, teamId: string) => { errorCode?: string } | null),
    }
    vm.runInNewContext(compiled, context)
    assert.ok(context.__actualValidator, 'production function must compile')
    const actual = context.__actualValidator([
      { groupId: 'group-b', microcycleId: 'micro-b' },
    ], '2026-11-04', activeTeam)
    assert.equal(actual?.errorCode ?? null, null,
      'authorized Team B prescription should be valid; legacy fixed team_1 yields groupNotFound')
    assert.equal((sqlite.prepare('SELECT count(*) AS n FROM group_session_prescriptions').get() as { n: number }).n, 0)
  } finally {
    sqlite.close()
  }
})

