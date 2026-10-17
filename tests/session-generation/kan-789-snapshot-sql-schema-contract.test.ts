import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { getTableColumns, getTableName } from 'drizzle-orm'
import { sessionGenerationReviewSnapshots } from '@/db/session-generation-review-snapshot-schema'

const read = (path: string) => readFileSync(path, 'utf8')

test('KAN-789 snapshot schema binds ownership, temporal lifecycle and exact payload', () => {
  assert.equal(getTableName(sessionGenerationReviewSnapshots), 'session_generation_review_snapshots')
  const columns = getTableColumns(sessionGenerationReviewSnapshots)
  for (const key of [
    'id', 'userId', 'teamId', 'groupTrainingPlanId', 'groupId',
    'planningCohortId', 'schemaVersion', 'generatorVersion',
    'proposal', 'generationExplanations', 'sourceManifest',
    'createdAt', 'expiresAt', 'status', 'consumedAt', 'resultReference',
  ]) assert.ok(Object.hasOwn(columns, key), `Missing snapshot column: ${key}`)
  assert.equal(columns.id.primary, true)
  assert.equal(columns.userId.notNull, true)
  assert.equal(columns.teamId.notNull, true)
  assert.equal(columns.groupTrainingPlanId.notNull, true)
  assert.equal(columns.proposal.notNull, true)
  assert.equal(columns.generationExplanations.notNull, true)
  assert.equal(columns.expiresAt.notNull, true)
  assert.equal(columns.status.notNull, true)
})

test('KAN-789 SQLite and PostgreSQL share a durable table and ownership constraints', () => {
  const sqlite = read('drizzle/sqlite/0026_session_generation_review_snapshots.sql')
  const postgres = read('drizzle/supabase/0039_session_generation_review_snapshots.sql')
  for (const sql of [sqlite, postgres]) {
    assert.match(sql, /session_generation_review_snapshots/)
    assert.match(sql, /expires_at/)
    assert.match(sql, /user_id/)
    assert.match(sql, /team_id/)
    assert.match(sql, /group_training_plan_id/)
    assert.match(sql, /generation_explanations/)
    assert.match(sql, /source_manifest/)
    assert.match(sql, /result_reference/)
  }
})
