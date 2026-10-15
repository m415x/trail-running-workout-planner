import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { readReviewPlanPeriodizationFactsPostgres } from '@/lib/session-generation/review-snapshot-plan-periodization-postgres'

const url = process.env.KAN789_PG_URL
if (url) {
  const parsed = new URL(url)
  if (parsed.hostname !== '127.0.0.1' || parsed.port !== '55439' ||
    parsed.pathname !== '/kan789_acceptance') {
    throw new Error('KAN-790 PG-2 may use only disposable PostgreSQL')
  }
}
const prefix = 'kan790-pg2-period'
const now = '2026-10-14T21:30:00.000Z'

test('KAN-790 PG-2 reads current microcycle ancestry and rejects deleted facts inside same SERIALIZABLE tx', { skip: !url }, async () => {
  const sql = postgres(url!, { max: 1, prepare: false })
  const scope = { groupTrainingPlanId: prefix + '-plan', teamId: prefix + '-team', groupId: prefix + '-group' }
  try {
    assert.equal((await sql<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db, 'kan789_acceptance')
    await sql`INSERT INTO teams (id,name,created_at,updated_at)
      VALUES (${scope.teamId},'PG2 disposable',${now},${now})`
    await sql`INSERT INTO athlete_groups (id,team_id,category_code,level_code,created_at,updated_at)
      VALUES (${scope.groupId},${scope.teamId},'trail','beginner',${now},${now})`
    await sql`INSERT INTO group_training_plans (id,group_id,title,created_at,updated_at)
      VALUES (${scope.groupTrainingPlanId},${scope.groupId},'PG2 scope',${now},${now})`
    await sql`INSERT INTO macrocycles
      (id,title,group_training_plan_id,start_date,end_date,target_race_name,
       target_race_distance_km,target_race_elevation_gain,created_at,updated_at)
      VALUES (${prefix+'-macro'},'PG2 Macro',${scope.groupTrainingPlanId},'2027-01-01','2027-03-31',
        'Race',21,1000,${now},${now})`
    await sql`INSERT INTO mesocycles
      (id,macrocycle_id,title,number,period,objective,created_at,updated_at)
      VALUES (${prefix+'-meso'},${prefix+'-macro'},'PG2 Meso',1,'general_preparatory',
        'base',${now},${now})`
    await sql`INSERT INTO microcycles
      (id,mesocycle_id,week_number,type,start_date,end_date,target_volume_km,created_at,updated_at)
      VALUES (${prefix+'-micro'},${prefix+'-meso'},1,'base','2027-01-04','2027-01-10',42,
        ${now},${now})`

    await sql.begin(async tx => {
      await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      const facts = await readReviewPlanPeriodizationFactsPostgres(tx, scope)
      assert.equal(facts?.microcycles.length, 1)
      assert.deepEqual(facts?.microcycles[0], {
        id: prefix+'-micro', macrocycleId: prefix+'-macro',
        macrocycleEndDate: '2027-03-31', macrocycleTargetRaceName: 'Race',
        macrocycleTargetRaceDistanceKm: 21, macrocycleTargetRaceElevationGain: 1000,
        mesocycleId: prefix+'-meso', period: 'general_preparatory',
        weekNumber: 1, type: 'base', startDate: '2027-01-04', endDate: '2027-01-10',
        targetVolumeKm: 42, targetElevationGain: null, targetDurationMin: null,
      })
      assert.equal(await readReviewPlanPeriodizationFactsPostgres(tx,
        { ...scope, teamId: 'foreign-team' }), null)
      await tx`UPDATE mesocycles SET is_deleted = true WHERE id = ${prefix+'-meso'}`
      const after = await readReviewPlanPeriodizationFactsPostgres(tx, scope)
      assert.deepEqual(after?.microcycles, [])
      // Simulate a concurrent invalidation within the same transaction;
      // this entire fixture mutation must roll back.
      throw new Error('pg2-rollback-sentinel')
    }).then(
      () => assert.fail('must roll back'),
      error => assert.match(String(error), /pg2-rollback-sentinel/),
    )
    const state = await sql<{ is_deleted: boolean }[]>`
      SELECT is_deleted FROM mesocycles WHERE id = ${prefix+'-meso'}`
    assert.equal(state[0]?.is_deleted, false)
  } finally {
    try {
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
