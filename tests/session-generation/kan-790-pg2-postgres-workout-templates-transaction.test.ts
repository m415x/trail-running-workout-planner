import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { readReviewWorkoutTemplateFactsPostgres } from '@/lib/session-generation/review-snapshot-workout-templates-postgres'

test('KAN-790 PG-2 PostgreSQL workout catalogue is Team-scoped, active and transactionally fresh', async () => {
  const url = process.env.KAN789_PG_URL
  assert.ok(url, 'Real disposable PG URL is mandatory; no SKIP')
  const target = new URL(url)
  assert.equal(target.hostname, '127.0.0.1')
  assert.equal(target.port, '55439')
  assert.equal(target.pathname, '/kan789_acceptance')
  const sql = postgres(url, { max: 1, prepare: false })
  const id = 'kan790-pg2-workouts'
  const now = '2026-10-14T21:30:00.000Z'
  const scope = { groupTrainingPlanId: id+'-plan', teamId: id+'-team', groupId: id+'-group' }
  try {
    assert.equal((await sql<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db,
      'kan789_acceptance')
    await sql`INSERT INTO teams (id,name,created_at,updated_at)
      VALUES (${scope.teamId},'PG2 workout',${now},${now})`
    await sql`INSERT INTO athlete_groups (id,team_id,category_code,level_code,created_at,updated_at)
      VALUES (${scope.groupId},${scope.teamId},'trail','beginner',${now},${now})`
    await sql`INSERT INTO group_training_plans (id,group_id,title,created_at,updated_at)
      VALUES (${scope.groupTrainingPlanId},${scope.groupId},'PG2 Plan',${now},${now})`
    await sql`INSERT INTO workouts (id,team_id,category,tags,title,type,distance,created_at,updated_at)
      VALUES (${id+'-active'},${scope.teamId},'endurance',${JSON.stringify(['easy'])}::jsonb,
        'Active workout','Trail',12,${now},${now})`
    await sql`INSERT INTO workouts (id,team_id,category,tags,title,type,archived_at,created_at,updated_at)
      VALUES (${id+'-archived'},${scope.teamId},'endurance',${JSON.stringify([])}::jsonb,
        'Archived workout','Trail',${now},${now},${now})`
    await sql.begin(async tx => {
      await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      const result = await readReviewWorkoutTemplateFactsPostgres(tx,scope)
      assert.deepEqual(result?.templates.map(t=>t.id), [id+'-active'])
      assert.deepEqual(result?.templates[0]?.tags, ['easy'])
      assert.equal(result?.templates[0]?.distanceKm, 12)
      assert.equal(await readReviewWorkoutTemplateFactsPostgres(tx,
        { ...scope, teamId: 'foreign-team' }), null)
      await tx`UPDATE workouts SET is_deleted = true WHERE id = ${id+'-active'}`
      assert.deepEqual((await readReviewWorkoutTemplateFactsPostgres(tx,scope))?.templates, [])
      throw new Error('pg2-workout-rollback')
    }).then(
      () => assert.fail('rollback required'),
      error => assert.match(String(error), /pg2-workout-rollback/),
    )
    const state = await sql<{ deleted: boolean }[]>`
      SELECT is_deleted AS deleted FROM workouts WHERE id = ${id+'-active'}`
    assert.equal(state[0]?.deleted,false)
  } finally {
    try {
      await sql`DELETE FROM workouts WHERE id IN (${id+'-active'},${id+'-archived'})`
      await sql`DELETE FROM group_training_plans WHERE id = ${scope.groupTrainingPlanId}`
      await sql`DELETE FROM athlete_groups WHERE id = ${scope.groupId}`
      await sql`DELETE FROM teams WHERE id = ${scope.teamId}`
    } finally {
      await sql.end()
    }
  }
})
