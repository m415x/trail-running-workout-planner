import assert from 'node:assert/strict'
import { getTableColumns } from 'drizzle-orm'
import { test } from 'node:test'
import { groupSessionPrescriptions as sqlitePrescriptions } from '../../db/schema'
import { groupSessionPrescriptions as postgresPrescriptions } from '../../db/supabase/schema'

test('KAN-878 RED-9 PostgreSQL prescription schema preserves SQLite vertical field parity and planning identity', () => {
  const sqlite = getTableColumns(sqlitePrescriptions) as Record<string, { name: string; notNull: boolean }>
  const postgres = getTableColumns(postgresPrescriptions) as Record<string, { name: string; notNull: boolean }>

  for (const field of ['primaryObjective', 'verticalBlockJson']) {
    assert.ok(postgres[field], `KAN-878 RED-9: missing PostgreSQL ${field} column`)
    assert.equal(postgres[field].name, sqlite[field].name, `Column naming must match SQLite for ${field}`)
    assert.equal(postgres[field].notNull, false, `${field} must remain nullable for legacy rows`)
  }

  for (const field of ['sessionId', 'groupId', 'microcycleId']) {
    assert.equal(postgres[field].name, sqlite[field].name)
    assert.equal(postgres[field].notNull, true)
  }

  assert.equal(postgres.elevationGain.name, 'elevation_gain', 'Whole-session D+ remains separate from the vertical block')
})
