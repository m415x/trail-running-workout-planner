import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { readReviewPlanCompetitionCalendarFactsPostgres } from '@/lib/session-generation/review-snapshot-competition-calendar-postgres'

test('KAN-790 PG-2 competition calendar uses Plan scoped real SERIALIZABLE SQL', async () => {
  const url = process.env.KAN789_PG_URL
  assert.ok(url, 'Real PostgreSQL required: no SKIP')
  const target = new URL(url)
  assert.equal(target.hostname, '127.0.0.1')
  assert.equal(target.port, '55439')
  assert.equal(target.pathname, '/kan791_regression_disposable')
  const sql = postgres(url, { max: 1, prepare: false })
  const id = 'kan790-pg2-calendar'
  const now = '2026-10-14T21:30:00.000Z'
  const scope = { groupTrainingPlanId: id+'-plan-a', teamId: id+'-team', groupId: id+'-group' }
  try {
    assert.equal((await sql<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db,
      'kan791_regression_disposable')
    await sql`INSERT INTO teams (id,name,created_at,updated_at)
      VALUES (${scope.teamId},'PG2 calendar',${now},${now})`
    await sql`INSERT INTO athlete_groups
      (id,team_id,category_code,level_code,created_at,updated_at)
      VALUES (${scope.groupId},${scope.teamId},'trail','beginner',${now},${now})`
    for (const name of ['a','b']) {
      await sql`INSERT INTO group_training_plans (id,group_id,title,created_at,updated_at)
        VALUES (${id+'-plan-'+name},${scope.groupId},${'Plan '+name},${now},${now})`
    }
    for (const [name,planId,date,status] of [
      ['first',id+'-plan-a','2027-05-01','planned'],
      ['last',id+'-plan-a','2027-07-01','cancelled'],
      ['foreign',id+'-plan-b','2027-06-01','confirmed'],
    ]) {
      await sql`INSERT INTO competition_entries
        (id,group_training_plan_id,name,date,distance_km,priority,status,created_at,updated_at)
        VALUES (${id+'-'+name},${planId},${name},${date},21,'A',${status},${now},${now})`
    }
    await sql.begin(async tx => {
      await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`
      const facts = await readReviewPlanCompetitionCalendarFactsPostgres(tx,scope)
      assert.deepEqual(facts?.competitions.map(x=>x.id),
        [id+'-first',id+'-last'], 'include cancelled, exclude sibling Plan')
      assert.equal(facts?.competitions[1]?.status,'cancelled')
      assert.equal(await readReviewPlanCompetitionCalendarFactsPostgres(tx,
        {...scope,teamId:'another-team'}),null)
      await tx`UPDATE competition_entries SET is_deleted = true WHERE id = ${id+'-first'}`
      assert.deepEqual((await readReviewPlanCompetitionCalendarFactsPostgres(tx,scope))
        ?.competitions.map(x=>x.id),[id+'-last'])
      throw new Error('pg2-calendar-rollback')
    }).then(
      ()=>assert.fail('expected rollback'),
      error=>assert.match(String(error),/pg2-calendar-rollback/),
    )
    const remaining=await sql<{ deleted:boolean }[]>`
      SELECT is_deleted AS deleted FROM competition_entries WHERE id = ${id+'-first'}`
    assert.equal(remaining[0]?.deleted,false)
  } finally {
    try {
      await sql`DELETE FROM competition_entries
        WHERE id IN (${id+'-first'},${id+'-last'},${id+'-foreign'})`
      await sql`DELETE FROM group_training_plans
        WHERE id IN (${id+'-plan-a'},${id+'-plan-b'})`
      await sql`DELETE FROM athlete_groups WHERE id = ${scope.groupId}`
      await sql`DELETE FROM teams WHERE id = ${scope.teamId}`
    } finally {
      await sql.end()
    }
  }
})
