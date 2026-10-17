import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import postgres from 'postgres'

import { assertSafeKan646BiometricPostgresTarget } from '@/scripts/test-runner'
import { createPersistedAuthorizedBiometricPostgresRepository } from '@/lib/physiology/biometric-self-postgres-authorized-repository'

assertSafeKan646BiometricPostgresTarget(process.env)
const url = process.env.KAN646_PG_URL!
const now = '2026-10-17T12:00:00.000Z'

test('KAN-646 PG-1 transactionally reauthorizes persisted SELF before CREATE, correction and replay', async () => {
  const sql = postgres(url, { max: 1, prepare: false })
  const suffix = randomUUID()
  const userId = 'kan646-pg1-user-' + suffix
  const teamId = 'kan646-pg1-team-' + suffix
  const athleteProfileId = 'kan646-pg1-profile-' + suffix
  const membershipId = 'kan646-pg1-member-' + suffix
  const subject = { status: 'resolved', userId, teamId, athleteProfileId } as const
  const create = { kind: 'weight', unit: 'kg', valueScaled: 725, observedOn: '2026-10-17', operationKey: 'create_1' }
  const repository = createPersistedAuthorizedBiometricPostgresRepository(sql, () => now)
  try {
    const identity = await sql<{ database: string }[]>`SELECT current_database() AS database`
    assert.equal(identity[0]?.database, 'kan646_biometric_disposable')
    await sql`INSERT INTO users (id,user_name,email,first_name,last_name,created_at,updated_at)
      VALUES (${userId},${userId},${userId + '@example.invalid'},'PG1','Self',${now},${now})`
    await sql`INSERT INTO teams (id,name,created_at,updated_at,time_zone)
      VALUES (${teamId},'KAN646 isolated PG1',${now},${now},'America/Argentina/San_Juan')`
    await sql`INSERT INTO team_memberships (id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at)
      VALUES (${membershipId},${userId},${teamId},'athlete','2026-01-01T00:00:00.000Z',true,${now},${now})`
    await sql`INSERT INTO athlete_profiles (id,user_id,team_id,dni,is_active,created_at,updated_at)
      VALUES (${athleteProfileId},${userId},${teamId},${suffix},true,${now},${now})`

    const first = await repository.create(subject, create)
    assert.equal(first.status, 'created')
    if (first.status !== 'created') return
    assert.deepEqual(await repository.create(subject, create),
      { status: 'replayed', id: first.id })
    assert.deepEqual(await repository.create(subject, { ...create, valueScaled: 731 }),
      { status: 'conflict' })

    const correction = {
      ...create, operationKey: 'correction_1', valueScaled: 731,
      supersedesObservationId: first.id, correctionReason: 'Measured again',
    }
    const corrected = await repository.correct(subject, correction)
    assert.equal(corrected.status, 'created')
    if (corrected.status !== 'created') return
    assert.deepEqual(await repository.correct(subject, correction),
      { status: 'replayed', id: corrected.id })
    assert.deepEqual(await repository.correct(subject, { ...correction, valueScaled: 740 }),
      { status: 'conflict' })

    const rows = await sql<{ id: string; value_scaled: number; supersedes_observation_id: string | null }[]>`
      SELECT id,value_scaled,supersedes_observation_id
      FROM athlete_biometric_observations WHERE team_id = ${teamId}
      ORDER BY recorded_at,id`
    assert.equal(rows.length, 2)
    assert.equal(rows.find(x => x.id === first.id)?.value_scaled, 725)
    assert.equal(rows.find(x => x.id === corrected.id)?.supersedes_observation_id, first.id)

    await sql`UPDATE team_memberships SET is_active=false WHERE id=${membershipId}`
    assert.deepEqual(await repository.create(subject, create), { status: 'denied' })
    assert.deepEqual(await repository.correct(subject, correction), { status: 'denied' })
    assert.deepEqual(await repository.create(subject, { ...create, operationKey:'after_revocation' }),
      { status: 'denied' })
    const durable = await sql<{ count: number }[]>`
      SELECT count(*)::integer AS count FROM athlete_biometric_observations WHERE team_id=${teamId}`
    assert.equal(durable[0]?.count, 2, 'DENY must not mutate durable rows')
  } finally {
    try {
      await sql`DELETE FROM athlete_biometric_observations WHERE team_id=${teamId}`
      await sql`DELETE FROM athlete_profiles WHERE id=${athleteProfileId}`
      await sql`DELETE FROM team_memberships WHERE id=${membershipId}`
      await sql`DELETE FROM teams WHERE id=${teamId}`
      await sql`DELETE FROM users WHERE id=${userId}`
    } finally { await sql.end() }
  }
})
