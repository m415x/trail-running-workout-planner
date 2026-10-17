import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'

import { assertSafeKan646BiometricPostgresTarget } from '@/scripts/test-runner'
import { resolveAuthorizedBiometricTeamTimeZone } from '@/lib/physiology/biometric-team-timezone-postgres'

assertSafeKan646BiometricPostgresTarget(process.env)

test('KAN-646 T5 PostgreSQL Team timezone resolver is server-owned and fail-closed', async () => {
  const sql = postgres(process.env.KAN646_PG_URL!, { max: 1, prepare: false })
  const id = 'kan646-tz-team-' + randomUUID()
  try {
    assert.equal((await sql<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db, 'kan646_biometric_disposable')
    await sql`INSERT INTO teams (id,name,created_at,updated_at)
      VALUES (${id},'KAN646 timezone probe','2026-10-17T12:00:00.000Z','2026-10-17T12:00:00.000Z')`
    assert.deepEqual(await resolveAuthorizedBiometricTeamTimeZone(sql, id), { status: 'denied' })
    await sql`UPDATE teams SET time_zone='Invalid/No_Such_Zone' WHERE id=${id}`
    assert.deepEqual(await resolveAuthorizedBiometricTeamTimeZone(sql, id), { status: 'denied' })
    await sql`UPDATE teams SET time_zone='America/Argentina/San_Juan' WHERE id=${id}`
    assert.deepEqual(await resolveAuthorizedBiometricTeamTimeZone(sql, id),
      { status: 'resolved', timeZone: 'America/Argentina/San_Juan' })
    assert.deepEqual(await resolveAuthorizedBiometricTeamTimeZone(sql, 'kan646-unknown-team'), { status: 'denied' })
    await sql`UPDATE teams SET is_deleted=true WHERE id=${id}`
    assert.deepEqual(await resolveAuthorizedBiometricTeamTimeZone(sql, id), { status: 'denied' })
  } finally {
    try { await sql`DELETE FROM teams WHERE id=${id}` } finally { await sql.end() }
  }
})
