import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { readReviewSnapshotPlanScopePostgres } from '@/lib/session-generation/review-snapshot-plan-scope-postgres'

const url = process.env.KAN789_PG_URL
if (url) {
  const target = new URL(url)
  if (target.hostname !== '127.0.0.1' || target.port !== '55439' ||
      target.pathname !== '/kan789_acceptance') {
    throw new Error('KAN-790 PG-2 requires disposable PostgreSQL')
  }
}
const id = 'kan790-pg2-scope'
const now = '2026-10-14T21:30:00.000Z'

test('KAN-790 PG-2 scoped Base Variant SQL read uses supplied serializable transaction', { skip: !url }, async () => {
  const sql = postgres(url!, { max: 1, prepare: false })
  try {
    assert.equal((await sql<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db, 'kan789_acceptance')
    await sql`INSERT INTO teams (id,name,created_at,updated_at)
      VALUES (${id+'-team'},'PG2 disposable',${now},${now})`
    await sql`INSERT INTO athlete_groups
      (id,team_id,category_code,level_code,created_at,updated_at)
      VALUES (${id+'-group'},${id+'-team'},'trail','beginner',${now},${now})`
    await sql`INSERT INTO planning_cohorts
      (id,team_id,group_id,name,purpose,created_at,updated_at)
      VALUES (${id+'-cohort'},${id+'-team'},${id+'-group'},'PG2 cohort','specific',${now},${now})`
    await sql`INSERT INTO group_training_plans (id,group_id,title,created_at,updated_at)
      VALUES (${id+'-base'},${id+'-group'},'PG2 Base',${now},${now})`
    await sql`INSERT INTO group_training_plans
      (id,group_id,planning_cohort_id,source_group_training_plan_id,title,created_at,updated_at)
      VALUES (${id+'-variant'},${id+'-group'},${id+'-cohort'},${id+'-base'},'PG2 Variant',${now},${now})`

    await sql.begin(async tx => {
      await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      assert.deepEqual(
        await readReviewSnapshotPlanScopePostgres(tx, {
          groupTrainingPlanId: id+'-variant', teamId: id+'-team', groupId: id+'-group',
        }),
        {
          groupTrainingPlanId: id+'-variant',
          teamId: id+'-team', groupId: id+'-group',
          planningCohortId: id+'-cohort',
          sourceGroupTrainingPlanId: id+'-base',
        },
      )
      assert.equal(await readReviewSnapshotPlanScopePostgres(tx, {
        groupTrainingPlanId: id+'-variant', teamId: 'foreign-team', groupId: id+'-group',
      }), null)
      assert.equal(await readReviewSnapshotPlanScopePostgres(tx, {
        groupTrainingPlanId: id+'-variant', teamId: id+'-team', groupId: 'foreign-group',
      }), null)
      const outside = await tx<{ transaction_isolation: string }[]>`SHOW transaction_isolation`
      assert.equal(outside[0]?.transaction_isolation, 'serializable')
    })
  } finally {
    try {
      await sql`DELETE FROM group_training_plans WHERE id = ${id+'-variant'}`
      await sql`DELETE FROM group_training_plans WHERE id = ${id+'-base'}`
      await sql`DELETE FROM planning_cohorts WHERE id = ${id+'-cohort'}`
      await sql`DELETE FROM athlete_groups WHERE id = ${id+'-group'}`
      await sql`DELETE FROM teams WHERE id = ${id+'-team'}`
    } finally {
      await sql.end()
    }
  }
})
