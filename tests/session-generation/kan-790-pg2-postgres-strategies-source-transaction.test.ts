import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { readReviewPlanStrategyFactsPostgres } from '@/lib/session-generation/review-snapshot-plan-strategies-postgres'

const url = process.env.KAN789_PG_URL
if (!url) throw new Error('BLOCKED: KAN789_PG_URL required')
{
  const target = new URL(url)
  if (target.hostname !== '127.0.0.1' || target.port !== '55439' ||
    target.pathname !== '/kan791_regression_disposable') {
    throw new Error('KAN-790 PG-2 strategy tests require disposable PostgreSQL')
  }
}
const prefix = 'kan790-pg2-strategy'
const now = '2026-10-14T21:30:00.000Z'
const scope = {
  groupTrainingPlanId: prefix + '-plan',
  teamId: prefix + '-team',
  groupId: prefix + '-group',
}

test('KAN-790 PG-2 reads scoped SQL strategies and intensity targets inside SERIALIZABLE transaction', async () => {
  const sql = postgres(url!, { max: 1, prepare: false })
  try {
    assert.equal((await sql<{ name: string }[]> `SELECT current_database() AS name`)[0]?.name,
      'kan791_regression_disposable')
    await sql`INSERT INTO teams (id,name,created_at,updated_at)
      VALUES (${scope.teamId},'PG-2 disposable',${now},${now})`
    await sql`INSERT INTO athlete_groups
      (id,team_id,category_code,level_code,created_at,updated_at)
      VALUES (${scope.groupId},${scope.teamId},'trail','beginner',${now},${now})`
    await sql`INSERT INTO group_training_plans (id,group_id,title,created_at,updated_at)
      VALUES (${scope.groupTrainingPlanId},${scope.groupId},'PG-2 Plan',${now},${now})`
    await sql`INSERT INTO macrocycles
      (id,title,group_training_plan_id,start_date,end_date,created_at,updated_at)
      VALUES (${prefix+'-macro'},'Macro',${scope.groupTrainingPlanId},
        '2027-01-01','2027-03-31',${now},${now})`
    await sql`INSERT INTO mesocycles
      (id,macrocycle_id,title,number,period,objective,created_at,updated_at)
      VALUES (${prefix+'-meso'},${prefix+'-macro'},'Meso',1,'general_preparatory',
        'base',${now},${now})`
    await sql`INSERT INTO microcycles
      (id,mesocycle_id,week_number,type,start_date,end_date,created_at,updated_at)
      VALUES (${prefix+'-micro'},${prefix+'-meso'},1,'base',
        '2027-01-04','2027-01-10',${now},${now})`
    await sql`INSERT INTO load_strategies
      (id,group_training_plan_id,goal_type,initial_weekly_volume_km,
       maximum_weekly_volume_km,sessions_per_week,maximum_weekly_increase_percentage,
       deload_percentage,field_sources,created_at,updated_at)
      VALUES (${prefix+'-load'},${scope.groupTrainingPlanId},'finish',
        30,60,4,10,30,${JSON.stringify({})}::jsonb,${now},${now})`
    await sql`INSERT INTO intensity_strategies
      (id,group_training_plan_id,goal_type,default_method,
       maximum_intense_sessions_per_week,minimum_recovery_days_between_intense_sessions,
       field_sources,created_at,updated_at)
      VALUES (${prefix+'-intensity'},${scope.groupTrainingPlanId},'finish',
        'hr_zone',2,2,${JSON.stringify({})}::jsonb,${now},${now})`
    await sql`INSERT INTO microcycle_intensity_targets
      (id,microcycle_id,emphasis,intense_sessions_target,predominant_zone,
       minimum_recovery_days_between_intense_sessions,field_sources,created_at,updated_at)
      VALUES (${prefix+'-target'},${prefix+'-micro'},'aerobic',1,'Z2',
        2,${JSON.stringify({})}::jsonb,${now},${now})`

    await sql.begin(async tx => {
      await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      const facts = await readReviewPlanStrategyFactsPostgres(tx, scope)
      assert.deepEqual(facts?.loadStrategy, {
        maximumWeeklyVolumeKm: 60, initialWeeklyVolumeKm: 30,
      })
      assert.deepEqual(facts?.intensityStrategy, {
        defaultMethod: 'hr_zone', maximumIntenseSessionsPerWeek: 2,
      })
      assert.deepEqual(Array.from(facts?.intensityTargets ?? []), [{
        microcycleId: prefix+'-micro', intenseSessionsTarget: 1,
        predominantZone: 'Z2', emphasis: 'aerobic',
        referencePercentageTarget: null, minimumRecoveryDaysBetweenIntenseSessions: 2,
      }])
      assert.equal(await readReviewPlanStrategyFactsPostgres(tx,
        { ...scope, teamId: 'foreign' }), null)
      await tx`UPDATE microcycle_intensity_targets SET is_deleted = true
        WHERE id = ${prefix+'-target'}`
      assert.deepEqual(
        Array.from((await readReviewPlanStrategyFactsPostgres(tx, scope))?.intensityTargets ?? []),
        [])
      throw new Error('pg2-strategy-rollback')
    }).then(
      () => assert.fail('transaction must roll back'),
      error => assert.match(String(error), /pg2-strategy-rollback/),
    )
    assert.equal((await sql<{ deleted: boolean }[]>`SELECT is_deleted AS deleted
      FROM microcycle_intensity_targets WHERE id = ${prefix+'-target'}`)[0]?.deleted, false)
  } finally {
    try {
      await sql`DELETE FROM microcycle_intensity_targets WHERE id = ${prefix+'-target'}`
      await sql`DELETE FROM intensity_strategies WHERE id = ${prefix+'-intensity'}`
      await sql`DELETE FROM load_strategies WHERE id = ${prefix+'-load'}`
      await sql`DELETE FROM microcycles WHERE id = ${prefix+'-micro'}`
      await sql`DELETE FROM mesocycles WHERE id = ${prefix+'-meso'}`
      await sql`DELETE FROM macrocycles WHERE id = ${prefix+'-macro'}`
      await sql`DELETE FROM group_training_plans WHERE id = ${scope.groupTrainingPlanId}`
      await sql`DELETE FROM athlete_groups WHERE id = ${scope.groupId}`
      await sql`DELETE FROM teams WHERE id = ${scope.teamId}`
    } finally {
      await sql.end()
    }
  }
})
