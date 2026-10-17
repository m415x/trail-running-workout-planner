import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import postgres from 'postgres'

import { assertSafeKan646BiometricPostgresTarget } from '@/scripts/test-runner'
import { createPersistedAuthorizedBiometricPostgresRepository } from '@/lib/physiology/biometric-self-postgres-authorized-repository'

assertSafeKan646BiometricPostgresTarget(process.env)
const url = process.env.KAN646_PG_URL!
const now = '2026-10-17T12:00:00.000Z'

test('KAN-646 PG-2 independent connections serialize same-key CREATE and preserve single durable row', async () => {
  const setup = postgres(url, { max: 1, prepare: false })
  const clients = [postgres(url, { max: 1, prepare: false }), postgres(url, { max: 1, prepare: false })]
  const suffix = randomUUID()
  const userId = 'kan646-pg2-user-' + suffix
  const teamId = 'kan646-pg2-team-' + suffix
  const athleteProfileId = 'kan646-pg2-profile-' + suffix
  const membershipId = 'kan646-pg2-member-' + suffix
  const subject = { status: 'resolved', userId, teamId, athleteProfileId } as const
  const input = { kind: 'weight', unit: 'kg', valueScaled: 725, observedOn: '2026-10-17', operationKey: 'same_key' }
  try {
    assert.equal((await setup<{ database: string }[]>`SELECT current_database() AS database`)[0]?.database, 'kan646_biometric_disposable')
    await setup`INSERT INTO users (id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${userId},${userId},${userId + '@example.invalid'},'PG2','Self',${now},${now})`
    await setup`INSERT INTO teams (id,name,created_at,updated_at,time_zone)
      VALUES (${teamId},'KAN646 dedicated PG2',${now},${now},'America/Argentina/San_Juan')`
    await setup`INSERT INTO team_memberships (id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at)
      VALUES (${membershipId},${userId},${teamId},'athlete','2026-01-01T00:00:00.000Z',true,${now},${now})`
    await setup`INSERT INTO athlete_profiles (id,user_id,team_id,dni,is_active,created_at,updated_at)
      VALUES (${athleteProfileId},${userId},${teamId},${suffix},true,${now},${now})`
    const pids = await Promise.all(clients.map(async sql =>
      (await sql<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`)[0].pid))
    assert.equal(new Set(pids).size, 2, 'must use different physical PostgreSQL connections')
    const repositories = clients.map(sql => createPersistedAuthorizedBiometricPostgresRepository(sql, () => now))
    const results = await Promise.all(repositories.map(repo => repo.create(subject, input)))
    assert.deepEqual(results.map(x => x.status).sort(), ['created', 'replayed'])
    const rows = await setup<{ id: string }[]>`SELECT id FROM athlete_biometric_observations WHERE team_id=${teamId}`
    assert.equal(rows.length, 1)
    const created = results.find(x => x.status === 'created')
    const replay = results.find(x => x.status === 'replayed')
    assert.equal(created?.status === 'created' ? created.id : null, replay?.status === 'replayed' ? replay.id : null)
  } finally {
    try {
      await setup`DELETE FROM athlete_biometric_observations WHERE team_id=${teamId}`
      await setup`DELETE FROM athlete_profiles WHERE id=${athleteProfileId}`
      await setup`DELETE FROM team_memberships WHERE id=${membershipId}`
      await setup`DELETE FROM teams WHERE id=${teamId}`
      await setup`DELETE FROM users WHERE id=${userId}`
    } finally {
      await Promise.all(clients.map(sql => sql.end()))
      await setup.end()
    }
  }
})

test('KAN-646 PG-2 invalid physical INSERT rolls back completely without orphaned biometric row', async () => {
  const sql = postgres(url, { max: 1, prepare: false })
  const id = 'kan646-pg2-invalid-' + randomUUID()
  try {
    await assert.rejects(sql.begin(async tx => {
      await tx`INSERT INTO athlete_biometric_observations
        (id,team_id,athlete_profile_id,kind,value_scaled,unit,observed_on,
         recorded_at,recorded_by_user_id,source,operation_key,request_digest)
        VALUES (${id},'nonexistent-team','nonexistent-profile','weight',725,'kg',
          '2026-10-17',${now},'nonexistent-user','athlete_declared','broken','digest')`
    }))
    const rows = await sql<{ n: number }[]>`SELECT count(*)::integer AS n
      FROM athlete_biometric_observations WHERE id=${id}`
    assert.equal(rows[0]?.n, 0)
  } finally { await sql.end() }
})
