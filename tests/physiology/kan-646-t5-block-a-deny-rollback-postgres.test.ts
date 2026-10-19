import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import postgres from 'postgres'

import { assertSafeKan646BiometricPostgresTarget } from '@/scripts/test-runner'
import { createPersistedAuthorizedBiometricPostgresRepository } from '@/lib/physiology/biometric-self-postgres-authorized-repository'

assertSafeKan646BiometricPostgresTarget(process.env)

test('KAN-646 Block A: denied writes are inert, authenticated repository rolls back after valid INSERT', async () => {
  const sql = postgres(process.env.KAN646_PG_URL!, { max: 1, prepare: false })
  const suffix = randomUUID()
  const userId = 'kan646-a-user-' + suffix
  const teamId = 'kan646-a-team-' + suffix
  const profileId = 'kan646-a-profile-' + suffix
  const membershipId = 'kan646-a-member-' + suffix
  const now = '2026-10-17T12:00:00.000Z'
  const subject = { status: 'resolved', userId, teamId, athleteProfileId: profileId } as const
  const input = { kind: 'weight', unit: 'kg', valueScaled: 725, observedOn: '2026-10-17', operationKey: 'a-deny' }
  try {
    assert.equal((await sql<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db, 'kan646_biometric_disposable')
    await sql`INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${userId},${userId},${userId+'@example.invalid'},'A','Deny',${now},${now})`
    await sql`INSERT INTO teams(id,name,time_zone,created_at,updated_at)
      VALUES (${teamId},'KAN646 A rollback','America/Argentina/San_Juan',${now},${now})`
    await sql`INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at)
      VALUES (${membershipId},${userId},${teamId},'athlete','2026-01-01T00:00:00.000Z',true,${now},${now})`
    await sql`INSERT INTO athlete_profiles(id,user_id,team_id,dni,is_active,created_at,updated_at)
      VALUES (${profileId},${userId},${teamId},${suffix},true,${now},${now})`

    const repository = createPersistedAuthorizedBiometricPostgresRepository(sql, () => now)
    await sql`UPDATE team_memberships SET is_active=false WHERE id=${membershipId}`
    assert.deepEqual(await repository.create(subject, input), { status: 'denied' })
    await sql`UPDATE team_memberships SET is_active=true WHERE id=${membershipId}`
    await sql`UPDATE teams SET time_zone=NULL WHERE id=${teamId}`
    assert.deepEqual(await repository.create(subject, input), { status: 'denied' })
    await sql`UPDATE teams SET time_zone='America/Argentina/San_Juan' WHERE id=${teamId}`
    assert.equal((await sql<{ n: number }[]>`SELECT count(*)::integer AS n FROM athlete_biometric_observations WHERE team_id=${teamId}`)[0]?.n, 0)

    const injected = createPersistedAuthorizedBiometricPostgresRepository(sql, () => now, {
      afterInsert: () => { throw new Error('KAN646_INTENTIONAL_POST_INSERT_ROLLBACK') },
    })
    await assert.rejects(
      () => injected.create(subject, { ...input, operationKey: 'a-fault' }),
      /KAN646_INTENTIONAL_POST_INSERT_ROLLBACK/,
    )
    assert.equal((await sql<{ n: number }[]>`SELECT count(*)::integer AS n FROM athlete_biometric_observations WHERE team_id=${teamId}`)[0]?.n, 0)
    const created = await repository.create(subject, { ...input, operationKey: 'a-after-rollback' })
    assert.equal(created.status, 'created')
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
