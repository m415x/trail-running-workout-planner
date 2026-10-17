import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import postgres from 'postgres'

import { assertSafeKan646BiometricPostgresTarget } from '@/scripts/test-runner'
import { createPersistedAuthorizedBiometricPostgresRepository } from '@/lib/physiology/biometric-self-postgres-authorized-repository'

assertSafeKan646BiometricPostgresTarget(process.env)
const url = process.env.KAN646_PG_URL!
const now = '2026-10-17T12:00:00.000Z'

test('KAN-646 T5 PG regional provenance is transactionally sealed, immutable across Team changes, and fail-closed', async () => {
  const sql = postgres(url, { max: 1, prepare: false })
  const suffix = randomUUID()
  const userId = 'kan646-tzwrite-user-' + suffix
  const teamId = 'kan646-tzwrite-team-' + suffix
  const profileId = 'kan646-tzwrite-profile-' + suffix
  const membershipId = 'kan646-tzwrite-member-' + suffix
  const subject = { status: 'resolved', userId, teamId, athleteProfileId: profileId } as const
  const repository = createPersistedAuthorizedBiometricPostgresRepository(sql, () => now)
  const create = { kind: 'weight', unit: 'kg', valueScaled: 725, observedOn: '2026-10-17', operationKey: 'first' }
  try {
    assert.equal((await sql<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db, 'kan646_biometric_disposable')
    await sql`INSERT INTO users (id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${userId},${userId},${userId + '@example.invalid'},'T5','Region',${now},${now})`
    await sql`INSERT INTO teams (id,name,created_at,updated_at)
      VALUES (${teamId},'KAN646 timezone writer probe',${now},${now})`
    await sql`INSERT INTO team_memberships (id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at)
      VALUES (${membershipId},${userId},${teamId},'athlete','2026-01-01T00:00:00.000Z',true,${now},${now})`
    await sql`INSERT INTO athlete_profiles (id,user_id,team_id,dni,is_active,created_at,updated_at)
      VALUES (${profileId},${userId},${teamId},${suffix},true,${now},${now})`

    assert.deepEqual(await repository.create(subject, create), { status: 'denied' })
    assert.equal((await sql<{ n: number }[]>`SELECT count(*)::integer AS n FROM athlete_biometric_observations WHERE team_id=${teamId}`)[0]?.n, 0)

    await sql`UPDATE teams SET time_zone='America/Argentina/San_Juan' WHERE id=${teamId}`
    const first = await repository.create(subject, create)
    assert.equal(first.status, 'created')
    if (first.status !== 'created') return
    const rows1 = await sql<{ observed_time_zone: string | null }[]>`
      SELECT observed_time_zone FROM athlete_biometric_observations WHERE id=${first.id}`
    assert.equal(rows1[0]?.observed_time_zone, 'America/Argentina/San_Juan')

    await sql`UPDATE teams SET time_zone='America/Bogota' WHERE id=${teamId}`
    const second = await repository.create(subject, { ...create, operationKey: 'second', valueScaled: 731 })
    assert.equal(second.status, 'created')
    if (second.status !== 'created') return
    const rows2 = await sql<{ id: string; observed_time_zone: string | null }[]>`
      SELECT id,observed_time_zone FROM athlete_biometric_observations WHERE team_id=${teamId}`
    assert.equal(rows2.find(x => x.id === first.id)?.observed_time_zone, 'America/Argentina/San_Juan')
    assert.equal(rows2.find(x => x.id === second.id)?.observed_time_zone, 'America/Bogota')

    await sql`UPDATE teams SET time_zone='Invalid/Unknown' WHERE id=${teamId}`
    assert.deepEqual(await repository.create(subject, { ...create, operationKey: 'third' }), { status: 'denied' })
    assert.deepEqual(await repository.create(subject, create), { status: 'denied' }, 'replay must reauthorize region')
    assert.equal((await sql<{ n: number }[]>`SELECT count(*)::integer AS n FROM athlete_biometric_observations WHERE team_id=${teamId}`)[0]?.n, 2)
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
