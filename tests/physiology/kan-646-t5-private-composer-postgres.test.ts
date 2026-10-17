import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import postgres from 'postgres'

import { assertSafeKan646BiometricPostgresTarget } from '@/scripts/test-runner'
import { createInternalBiometricPostgresComposer } from '@/lib/physiology/biometric-self-postgres-composer'

assertSafeKan646BiometricPostgresTarget(process.env)
const now = '2026-10-17T12:00:00.000Z'

test('KAN-646 T5 private PG composer derives SELF authority and civil date server-side, never from payload identity', async () => {
  const sql = postgres(process.env.KAN646_PG_URL!, { max: 1, prepare: false })
  const suffix = randomUUID()
  const userId = 'kan646-composer-user-' + suffix
  const teamId = 'kan646-composer-team-' + suffix
  const profileId = 'kan646-composer-profile-' + suffix
  const membershipId = 'kan646-composer-member-' + suffix
  let authority: { status: 'resolved'; userId: string; teamId: string; athleteProfileId: string } | { status: 'denied' } =
    { status: 'resolved', userId, teamId, athleteProfileId: profileId }
  const composer = createInternalBiometricPostgresComposer({
    sql,
    resolveSelfAuthority: async () => authority,
    clock: () => new Date(now),
  })
  const input = { kind: 'weight', unit: 'kg', value: '72.5', observedOn: '2026-10-17', operationKey: 'first' }
  try {
    assert.equal((await sql<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db, 'kan646_biometric_disposable')
    await sql`INSERT INTO users (id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${userId},${userId},${userId + '@example.invalid'},'T5','Composer',${now},${now})`
    await sql`INSERT INTO teams (id,name,time_zone,created_at,updated_at)
      VALUES (${teamId},'KAN646 private composer','America/Argentina/San_Juan',${now},${now})`
    await sql`INSERT INTO team_memberships (id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at)
      VALUES (${membershipId},${userId},${teamId},'athlete','2026-01-01T00:00:00.000Z',true,${now},${now})`
    await sql`INSERT INTO athlete_profiles (id,user_id,team_id,dni,is_active,created_at,updated_at)
      VALUES (${profileId},${userId},${teamId},${suffix},true,${now},${now})`

    // Model untrusted extra JSON fields without broadening the typed input contract.
    const untrustedPayload = {
      ...input, userId: 'foreign-user', teamId: 'foreign-team',
      athleteProfileId: 'foreign-profile', timeZone: 'Pacific/Honolulu',
    }
    const written = await composer.create(untrustedPayload)
    assert.equal(written.status, 'persisted')
    const rows = await sql<{ team_id: string; athlete_profile_id: string; observed_time_zone: string }[]>`
      SELECT team_id,athlete_profile_id,observed_time_zone
      FROM athlete_biometric_observations WHERE team_id=${teamId}`
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.team_id, teamId)
    assert.equal(rows[0]?.athlete_profile_id, profileId)
    assert.equal(rows[0]?.observed_time_zone, 'America/Argentina/San_Juan')

    authority = { status: 'denied' }
    assert.deepEqual(await composer.create({ ...input, operationKey: 'denied' }), { status: 'denied' })
    assert.deepEqual(await composer.create(input), { status: 'denied' }, 'even replay rechecks request authority')
    assert.equal((await sql<{ n: number }[]>`SELECT count(*)::integer AS n FROM athlete_biometric_observations WHERE team_id=${teamId}`)[0]?.n, 1)
  } finally {
    try {
      await sql`DELETE FROM athlete_biometric_observations WHERE team_id=${teamId}`
      await sql`DELETE FROM athlete_profiles WHERE id=${profileId}`
      await sql`DELETE FROM team_memberships WHERE id=${membershipId}`
      await sql`DELETE FROM teams WHERE id=${teamId}`
      await sql`DELETE FROM users WHERE id=${userId}`
    } finally { await sql.end() }
  }
})
