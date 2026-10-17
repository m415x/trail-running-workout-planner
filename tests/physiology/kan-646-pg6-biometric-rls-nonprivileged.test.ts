import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import postgres from 'postgres'

import { assertSafeKan646BiometricPostgresTarget } from '@/scripts/test-runner'

assertSafeKan646BiometricPostgresTarget(process.env)
const url = process.env.KAN646_PG_URL!

test('KAN-646 PG-6 nonprivileged role is denied biometric SELECT and INSERT by RLS without policies', async () => {
  const sql = postgres(url, { max: 1, prepare: false })
  const role = 'kan646_rls_probe'
  try {
    const target = await sql<{ database: string; role: string }[]>`SELECT current_database() AS database, current_user AS role`
    assert.equal(target[0]?.database, 'kan646_biometric_disposable')
    assert.equal(target[0]?.role, 'biometric')
    const info = await sql<{ issuper: boolean; bypass: boolean }[]>`
      SELECT rolsuper AS issuper, rolbypassrls AS bypass FROM pg_roles WHERE rolname=${role}`
    assert.equal(info.length, 1, 'provision only this dedicated ephemeral role before executing PG-6')
    assert.equal(info[0]?.issuper, false)
    assert.equal(info[0]?.bypass, false)
    await sql.begin(async tx => {
      await tx.unsafe('SET LOCAL ROLE "' + role + '"')
      const current = await tx<{ role: string }[]>`SELECT current_user AS role`
      assert.equal(current[0]?.role, role)
      const rows = await tx<{ n: number }[]>`
        SELECT count(*)::integer AS n FROM public.athlete_biometric_observations`
      assert.equal(rows[0]?.n, 0, 'default-deny RLS must hide records')
    })
    await assert.rejects(
      sql.begin(async tx => {
        await tx.unsafe('SET LOCAL ROLE "' + role + '"')
        await tx`INSERT INTO public.athlete_biometric_observations
          (id, team_id, athlete_profile_id, kind, value_scaled, unit, observed_on, recorded_at,
           recorded_by_user_id, source, operation_key, request_digest)
          VALUES (${randomUUID()},'missing-team','missing-profile','weight',725,'kg',
            '2026-10-17','2026-10-17T12:00:00.000Z','missing-user',
            'athlete_declared','pg6_probe','digest')`
      }), /row-level security|permission denied/i,
    )
  } finally { await sql.end() }
})
