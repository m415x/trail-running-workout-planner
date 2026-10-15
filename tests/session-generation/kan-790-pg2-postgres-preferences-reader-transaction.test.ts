import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { readReviewPlanGenerationPreferencesPostgres } from '@/lib/session-generation/review-snapshot-plan-preferences-postgres'
import { projectReviewSqlGenerationPreferences } from '@/lib/session-generation/review-snapshot-effective-preferences'

test('KAN-790 PG-2 preferences use actual PG transaction and distinguish missing row from SQL failure', async () => {
  const url = process.env.KAN789_PG_URL
  assert.ok(url, 'PostgreSQL URL mandatory; no SKIP')
  const target = new URL(url)
  assert.equal(target.hostname, '127.0.0.1')
  assert.equal(target.port, '55439')
  assert.equal(target.pathname, '/kan789_acceptance')
  const sql = postgres(url, { max: 1, prepare: false })
  const id = 'kan790-pg2-pref-reader'
  const now = '2026-10-14T21:30:00.000Z'
  const scope = { groupTrainingPlanId: id + '-plan', teamId: id + '-team', groupId: id + '-group' }
  try {
    await sql`INSERT INTO teams (id,name,created_at,updated_at)
      VALUES (${scope.teamId},'PG2 preferences',${now},${now})`
    await sql`INSERT INTO athlete_groups (id,team_id,category_code,level_code,created_at,updated_at)
      VALUES (${scope.groupId},${scope.teamId},'trail','beginner',${now},${now})`
    await sql`INSERT INTO group_training_plans (id,group_id,title,created_at,updated_at)
      VALUES (${scope.groupTrainingPlanId},${scope.groupId},'PG2 Plan',${now},${now})`
    await sql.begin(async tx => {
      await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      assert.equal(await readReviewPlanGenerationPreferencesPostgres(tx, scope), null)
      assert.deepEqual(projectReviewSqlGenerationPreferences(
        await readReviewPlanGenerationPreferencesPostgres(tx, scope)),
      projectReviewSqlGenerationPreferences(null))
      const pattern = JSON.stringify([{ weekday: 'monday', role: 'easy' }])
      await tx`INSERT INTO session_generation_preferences
        (id,group_training_plan_id,frequency_mode,weekly_pattern,created_at,updated_at)
        VALUES (${id+'-pref'},${scope.groupTrainingPlanId},'auto',${pattern},${now},${now})`
      assert.deepEqual(await readReviewPlanGenerationPreferencesPostgres(tx, scope), {
        ...scope, frequencyMode: 'auto', fixedSessionsPerWeek: null,
        weeklyPattern: [{ weekday: 'monday', role: 'easy' }],
      })
      assert.equal(await readReviewPlanGenerationPreferencesPostgres(tx,
        { ...scope, teamId: 'foreign-team' }), null)
      await tx`UPDATE session_generation_preferences SET weekly_pattern = 'not-json'
        WHERE id = ${id+'-pref'}`
      await assert.rejects(readReviewPlanGenerationPreferencesPostgres(tx, scope),
        /Invalid persisted generation preference pattern JSON/)
      throw new Error('rollback-fixture')
    }).then(
      () => assert.fail('expected rollback'),
      error => assert.match(String(error), /rollback-fixture/),
    )
    assert.equal((await sql`SELECT id FROM session_generation_preferences
      WHERE id = ${id+'-pref'}`).length, 0)
    await sql.begin(async tx => {
      await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      await tx`SET LOCAL search_path TO pg_catalog`
      await assert.rejects(readReviewPlanGenerationPreferencesPostgres(tx, scope),
        error => error !== null && typeof error === 'object' &&
          'code' in error && error.code === '42P01')
    })
  } finally {
    try {
      await sql`DELETE FROM session_generation_preferences WHERE id = ${id+'-pref'}`
      await sql`DELETE FROM group_training_plans WHERE id = ${scope.groupTrainingPlanId}`
      await sql`DELETE FROM athlete_groups WHERE id = ${scope.groupId}`
      await sql`DELETE FROM teams WHERE id = ${scope.teamId}`
    } finally {
      await sql.end()
    }
  }
})
