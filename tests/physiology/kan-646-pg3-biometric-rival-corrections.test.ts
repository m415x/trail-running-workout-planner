import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import postgres from 'postgres'

import { assertSafeKan646BiometricPostgresTarget } from '@/scripts/test-runner'
import { createPersistedAuthorizedBiometricPostgresRepository } from '@/lib/physiology/biometric-self-postgres-authorized-repository'

assertSafeKan646BiometricPostgresTarget(process.env)
const url = process.env.KAN646_PG_URL!
const now = '2026-10-17T12:00:00.000Z'

test('KAN-646 PG-3 independent corrections racing for one predecessor have a single append-only winner', async () => {
  const setup = postgres(url, { max: 1, prepare: false })
  const clients = [postgres(url, { max: 1, prepare: false }), postgres(url, { max: 1, prepare: false })]
  const suffix = randomUUID()
  const userId = 'kan646-pg3-user-' + suffix
  const teamId = 'kan646-pg3-team-' + suffix
  const athleteProfileId = 'kan646-pg3-profile-' + suffix
  const membershipId = 'kan646-pg3-member-' + suffix
  const subject = { status: 'resolved', userId, teamId, athleteProfileId } as const
  const input = { kind: 'weight', unit: 'kg', valueScaled: 725, observedOn: '2026-10-17', operationKey: 'original' }
  try {
    assert.equal((await setup<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db, 'kan646_biometric_disposable')
    await setup`INSERT INTO users (id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${userId},${userId},${userId + '@example.invalid'},'PG3','Self',${now},${now})`
    await setup`INSERT INTO teams (id,name,created_at,updated_at) VALUES (${teamId},'KAN646 PG3',${now},${now})`
    await setup`INSERT INTO team_memberships (id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at)
      VALUES (${membershipId},${userId},${teamId},'athlete','2026-01-01T00:00:00.000Z',true,${now},${now})`
    await setup`INSERT INTO athlete_profiles (id,user_id,team_id,dni,is_active,created_at,updated_at)
      VALUES (${athleteProfileId},${userId},${teamId},${suffix},true,${now},${now})`
    const baseRepo = createPersistedAuthorizedBiometricPostgresRepository(setup, () => now)
    const original = await baseRepo.create(subject, input)
    assert.equal(original.status, 'created')
    if (original.status !== 'created') return

    const pids = await Promise.all(clients.map(async sql =>
      (await sql<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`)[0].pid))
    assert.equal(new Set(pids).size, 2)
    const contenders = clients.map((sql, i) =>
      createPersistedAuthorizedBiometricPostgresRepository(sql, () => now).correct(subject, {
        ...input, valueScaled: 731 + i, operationKey: 'correction_' + i,
        supersedesObservationId: original.id, correctionReason: 'Rival ' + i,
      }))
    const results = await Promise.all(contenders)
    assert.deepEqual(results.map(x => x.status).sort(), ['created', 'denied'])
    const rows = await setup<{ id: string; value_scaled: number; supersedes_observation_id: string | null }[]>`
      SELECT id,value_scaled,supersedes_observation_id
      FROM athlete_biometric_observations WHERE team_id=${teamId}`
    assert.equal(rows.length, 2)
    assert.equal(rows.find(x => x.id === original.id)?.value_scaled, 725)
    assert.equal(rows.filter(x => x.supersedes_observation_id === original.id).length, 1)
  } finally {
    try {
      await setup`DELETE FROM athlete_biometric_observations WHERE team_id=${teamId} AND supersedes_observation_id IS NOT NULL`
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
