import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import postgres from 'postgres'

import { assertSafeKan646BiometricPostgresTarget } from '@/scripts/test-runner'
import { readCurrentSelfDeclaredBiometricsPostgres } from '@/lib/physiology/biometric-self-postgres-read'

assertSafeKan646BiometricPostgresTarget(process.env)

test('KAN-646 Block A: persisted PostgreSQL SELF read applies T4 effectiveOn/knownAt cuts and isolates Team/Profile', async () => {
  const sql = postgres(process.env.KAN646_PG_URL!, { max: 1, prepare: false })
  const suffix = randomUUID()
  const teamId = 'kan646-read-team-' + suffix
  const foreignTeamId = 'kan646-read-other-team-' + suffix
  const userId = 'kan646-read-user-' + suffix
  const ownId = 'kan646-read-profile-' + suffix
  const otherId = 'kan646-read-other-profile-' + suffix
  const membershipId = 'kan646-read-membership-' + suffix
  const observationId = 'kan646-read-observation-' + suffix
  const subject = { status: 'resolved' as const, userId, teamId, athleteProfileId: ownId }
  const at = '2026-10-17T12:00:00.000Z'
  try {
    assert.equal((await sql<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db, 'kan646_biometric_disposable')
    await sql`INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${userId},${userId},${userId+'@example.invalid'},'T5','Read',${at},${at})`
    await sql`INSERT INTO teams(id,name,time_zone,created_at,updated_at)
      VALUES (${teamId},'KAN646 own read','America/Argentina/San_Juan',${at},${at}),
             (${foreignTeamId},'KAN646 foreign read','America/Bogota',${at},${at})`
    await sql`INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at)
      VALUES (${membershipId},${userId},${teamId},'athlete','2026-01-01T00:00:00.000Z',true,${at},${at})`
    await sql`INSERT INTO athlete_profiles(id,user_id,team_id,dni,is_active,created_at,updated_at)
      VALUES (${ownId},${userId},${teamId},${suffix+'a'},true,${at},${at}),
             (${otherId},NULL,${foreignTeamId},${suffix+'b'},true,${at},${at})`
    await sql`INSERT INTO athlete_biometric_observations
      (id,team_id,athlete_profile_id,kind,value_scaled,unit,observed_on,observed_time_zone,
       recorded_at,recorded_by_user_id,source,operation_key,request_digest)
      VALUES (${observationId},${teamId},${ownId},'weight',725,'kg','2026-10-14',
       'America/Argentina/San_Juan','2026-10-15T12:00:00.000Z',${userId},
       'athlete_declared','kan646_read',${suffix})`

    const beforeKnown = await readCurrentSelfDeclaredBiometricsPostgres(sql, subject, {
      effectiveOn: '2026-10-17', knownAt: '2026-10-14T23:59:59.000Z',
    })
    assert.equal(beforeKnown.status, 'loaded')
    if (beforeKnown.status !== 'loaded') return
    assert.equal(beforeKnown.current.weight, null)

    const visible = await readCurrentSelfDeclaredBiometricsPostgres(sql, subject, {
      effectiveOn: '2026-10-17', knownAt: '2026-10-17T12:00:00.000Z',
    })
    assert.equal(visible.status, 'loaded')
    if (visible.status !== 'loaded') return
    assert.equal(visible.current.weight?.id, observationId)
    assert.equal(visible.current.weight?.valueScaled, 725)

    const foreign = await readCurrentSelfDeclaredBiometricsPostgres(sql,
      { ...subject, teamId: foreignTeamId, athleteProfileId: otherId }, {
      effectiveOn: '2026-10-17', knownAt: '2026-10-17T12:00:00.000Z',
    })
    assert.deepEqual(foreign, { status: 'denied' })
    await sql`UPDATE team_memberships SET is_active=false WHERE id=${membershipId}`
    assert.deepEqual(await readCurrentSelfDeclaredBiometricsPostgres(sql, subject, {
      effectiveOn: '2026-10-17', knownAt: '2026-10-17T12:00:00.000Z',
    }), { status: 'denied' })
  } finally {
    try {
      await sql`DELETE FROM athlete_biometric_observations WHERE id=${observationId}`
      await sql`DELETE FROM athlete_profiles WHERE id IN (${ownId},${otherId})`
      await sql`DELETE FROM team_memberships WHERE id=${membershipId}`
      await sql`DELETE FROM teams WHERE id IN (${teamId},${foreignTeamId})`
      await sql`DELETE FROM users WHERE id=${userId}`
    } finally { await sql.end() }
  }
})
