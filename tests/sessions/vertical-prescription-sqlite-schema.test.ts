import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getTableColumns } from 'drizzle-orm'
import { groupSessionPrescriptions } from '../../db/schema'

test('KAN-878 RED-4 adds optional vertical payload and primary objective without changing SQLite prescription identity', () => {
  const columns = getTableColumns(groupSessionPrescriptions) as Record<string, { name: string; notNull: boolean }>
  const primaryObjective = columns.primaryObjective
  const verticalBlockJson = columns.verticalBlockJson

  assert.ok(primaryObjective, 'KAN-878 RED-4: SQLite GroupSessionPrescription needs primaryObjective')
  assert.ok(verticalBlockJson, 'KAN-878 RED-4: SQLite GroupSessionPrescription needs verticalBlockJson')

  assert.equal(primaryObjective.name, 'primary_objective')
  assert.equal(primaryObjective.notNull, false, 'Legacy prescriptions must preserve a nullable objective')
  assert.equal(verticalBlockJson.name, 'vertical_block_json')
  assert.equal(verticalBlockJson.notNull, false, 'Legacy prescriptions must preserve an absent vertical JSON')

  assert.equal(columns.sessionId.name, 'session_id')
  assert.equal(columns.microcycleId.name, 'microcycle_id')
  assert.equal(columns.sessionId.notNull, true)
  assert.equal(columns.microcycleId.notNull, true)
  assert.equal(columns.elevationGain.name, 'elevation_gain', 'Whole-session D+ must remain its own column')
})
