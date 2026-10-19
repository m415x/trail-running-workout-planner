import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import postgres from 'postgres'

import { assertSafeKan646BiometricPostgresTarget } from '@/scripts/test-runner'

assertSafeKan646BiometricPostgresTarget(process.env)
const url = process.env.KAN646_PG_URL!
const now = '2026-10-17T12:00:00.000Z'

test('KAN-646 PG-4 PostgreSQL rolls back a valid biometric INSERT when a later transactional step fails', async () => {
  const sql = postgres(url, { max: 1, prepare: false })
  const suffix = randomUUID()
  const userId = 'kan646-pg4-user-' + suffix
  const teamId = 'kan646-pg4-team-' + suffix
  const profileId = 'kan646-pg4-profile-' + suffix
  const observationId = 'kan646-pg4-observation-' + suffix
  try {
    assert.equal((await sql<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db, 'kan646_biometric_disposable')
    await sql`INSERT INTO users (id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${userId},${userId},${userId + '@example.invalid'},'PG4','Rollback',${now},${now})`
    await sql`INSERT INTO teams (id,name,created_at,updated_at)
      VALUES (${teamId},'KAN646 PG4 isolated',${now},${now})`
    await sql`INSERT INTO athlete_profiles (id,user_id,team_id,dni,is_active,created_at,updated_at)
      VALUES (${profileId},${userId},${teamId},${suffix},true,${now},${now})`

    await assert.rejects(sql.begin(async tx => {
      await tx`INSERT INTO athlete_biometric_observations
        (id,team_id,athlete_profile_id,kind,value_scaled,unit,observed_on,
         recorded_at,recorded_by_user_id,source,operation_key,request_digest)
        VALUES (${observationId},${teamId},${profileId},'weight',725,'kg',
          '2026-10-17',${now},${userId},'athlete_declared','rollback_op','valid_digest')`
      const inside = await tx<{ n: number }[]>`
        SELECT count(*)::integer AS n FROM athlete_biometric_observations WHERE id=${observationId}`
      assert.equal(inside[0]?.n, 1, 'INSERT must be valid and visible inside transaction')
      throw new Error('KAN646_PG4_INJECTED_POST_INSERT_FAILURE')
    }), /KAN646_PG4_INJECTED_POST_INSERT_FAILURE/)

    const durable = await sql<{ n: number }[]>`
      SELECT count(*)::integer AS n FROM athlete_biometric_observations WHERE id=${observationId}`
    assert.equal(durable[0]?.n, 0, 'no row survives after failed transaction')
  } finally {
    try {
      await sql`DELETE FROM athlete_biometric_observations WHERE id=${observationId}`
      await sql`DELETE FROM athlete_profiles WHERE id=${profileId}`
      await sql`DELETE FROM teams WHERE id=${teamId}`
      await sql`DELETE FROM users WHERE id=${userId}`
    } finally { await sql.end() }
  }
})
