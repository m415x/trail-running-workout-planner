import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { generateReviewSnapshotFromEffectivePostgres } from '@/lib/session-generation/review-snapshot-generate-postgres'
import { GENERATION_EXPLANATION_STAGE_ORDER } from '@/lib/session-generation/generation-explanation'
import { SESSION_GENERATION_SNAPSHOT_LIMITS } from '@/lib/session-generation/review-snapshot-limits'

const ID = 'kan791-annual-pg-239'
const scope = {
  groupTrainingPlanId: ID + '-plan',
  teamId: ID + '-team',
  groupId: ID + '-group',
  planningCohortId: null,
}

test('KAN-791 53 persisted PG microcycles generate 239 real events with complete causal evidence', async () => {
  const url = process.env.KAN789_PG_URL
  assert.ok(url, 'KAN789_PG_URL is mandatory; SKIP forbidden')
  const target = new URL(url)
  assert.equal(target.hostname, '127.0.0.1')
  assert.equal(target.port, '55439')
  assert.equal(target.pathname, '/kan789_acceptance')

  const sql = postgres(url, { max: 1, prepare: false })
  try {
    const result = await sql.begin(async tx => {
      await tx`SET TRANSACTION READ ONLY`
      const database = await tx<{ db: string }[]>`SELECT current_database() AS db`
      assert.equal(database[0]?.db, 'kan789_acceptance')
      const rows = await tx<{ count: number }[]>`
        SELECT count(*)::integer AS count
        FROM microcycles AS mi
        JOIN mesocycles AS me ON me.id = mi.mesocycle_id
        JOIN macrocycles AS ma ON ma.id = me.macrocycle_id
        WHERE ma.group_training_plan_id = ${scope.groupTrainingPlanId}
      `
      assert.equal(rows[0]?.count, 53, 'Existing annual fixture must not be recreated')
      return generateReviewSnapshotFromEffectivePostgres(tx, scope)
    })

    assert.equal(result.microcycleCount, 53)
    assert.equal(result.sourceManifest.generationInputCount, 53)
    assert.equal(result.sessionCount, 239)
    assert.equal(result.proposal.events.length, 239)
    assert.equal(new Set(result.proposal.events.map(event => event.sharedEventKey)).size, 239)
    assert.equal(result.proposal.events.flatMap(event => event.prescriptions).length, 239)
    assert.equal(Object.keys(result.generationExplanations).length, 239)
    for (const explanation of Object.values(result.generationExplanations)) {
      assert.deepEqual(explanation.stages.map(stage => stage.stage), [...GENERATION_EXPLANATION_STAGE_ORDER])
    }
    assert.ok(result.sessionCount <= SESSION_GENERATION_SNAPSHOT_LIMITS.maxSessions)
    assert.ok(result.microcycleCount <= SESSION_GENERATION_SNAPSHOT_LIMITS.maxMicrocycles)
  } finally {
    await sql.end()
  }
})
