import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import type { db as ApplicationDatabase } from '@/db'
import { competitionEntries } from '@/db/competition-entry-schema'
import { createCoachHomeNextCompetitionQuery } from '@/lib/coach-home/next-competition-query'
import { createCoachHomeNextCompetitionReader } from '@/lib/coach-home/next-competition-reader'

test('KAN-867/T4 one SQL SELECT selects only future, nondeleted active entries of authorized Plans', async () => {
  const queries: string[] = []
  const sqlite = new Database(':memory:', {
    verbose: (sql) => { if (typeof sql === 'string') queries.push(sql) },
  })
  try {
    sqlite.exec(`
      CREATE TABLE competition_entries (
        id TEXT PRIMARY KEY,
        group_training_plan_id TEXT NOT NULL,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        distance_km REAL NOT NULL,
        elevation_gain_m REAL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        description TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    const insert = sqlite.prepare(`INSERT INTO competition_entries
      (id, group_training_plan_id, name, date, distance_km, priority, status, is_deleted, created_at, updated_at)
      VALUES (?, ?, ?, ?, 20, 'B', ?, ?, '2026-11-01', '2026-11-01')`)
    insert.run('foreign', 'other', 'Foreign', '2026-11-04', 'confirmed', 0)
    insert.run('cancelled', 'plan_1', 'Cancelled', '2026-11-04', 'cancelled', 0)
    insert.run('deleted', 'plan_1', 'Deleted', '2026-11-04', 'planned', 1)
    insert.run('past', 'plan_1', 'Past', '2026-11-03', 'confirmed', 0)
    insert.run('upcoming', 'plan_2', 'Upcoming', '2026-11-05', 'planned', 0)
    insert.run('later', 'plan_1', 'Later', '2026-12-10', 'confirmed', 0)

    const database = drizzle(sqlite, { schema: { competitionEntries } }) as unknown as typeof ApplicationDatabase
    const query = createCoachHomeNextCompetitionQuery(database)
    queries.length = 0
    const records = await query(['plan_1', 'plan_2'], '2026-11-04')
    assert.deepEqual(records.map((entry) => entry.id), ['upcoming'])
    const selects = queries.filter((sql) => /^select\b/i.test(sql.trim()))
    assert.equal(selects.length, 1, 'no per-Plan SQL reads, even for 2 authorized Plans')
    assert.match(selects[0]!, /group_training_plan_id/i)
    assert.match(selects[0]!, /limit/i)
    assert.equal(queries.some((sql) => /^(insert|update|delete)\b/i.test(sql.trim())), false)

    queries.length = 0
    assert.deepEqual(await query([], '2026-11-04'), [])
    assert.equal(queries.length, 0, 'empty authorized Plan set never executes SQL')
  } finally {
    sqlite.close()
  }
})

test('KAN-867/T4 service never reads competitions before Plan authorization', async () => {
  let reads = 0
  const reader = createCoachHomeNextCompetitionReader({
    loadAuthorizedPlans: async () => ({ status: 'denied' }),
    readCandidates: async () => { reads++; return [] },
    today: () => '2026-11-04',
  })
  assert.deepEqual(await reader.read(), { status: 'denied' })
  assert.equal(reads, 0)

  const allowed = createCoachHomeNextCompetitionReader({
    loadAuthorizedPlans: async () => ({ status: 'ready', plans: [{ id: 'plan_1' }, { id: 'plan_2' }] }),
    readCandidates: async (ids) => {
      reads++
      assert.deepEqual(ids, ['plan_1', 'plan_2'])
      return [{
        id: 'race', groupTrainingPlanId: 'plan_2', name: 'Race',
        date: '2026-11-05', status: 'planned' as const, priority: 'B' as const,
        distanceKm: 20, isDeleted: false,
      }]
    },
    today: () => '2026-11-04',
  })
  const result = await allowed.read()
  assert.equal(result.status, 'ready')
  assert.equal(reads, 1)
})
