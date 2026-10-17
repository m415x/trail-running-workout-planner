import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

import { assertSafeKan646BiometricPostgresTarget } from '@/scripts/test-runner'

assertSafeKan646BiometricPostgresTarget(process.env)
const url = process.env.KAN646_PG_URL!

test('KAN-646 PG-5 distinguishes RLS enabled, table owner, bypass privileges and effective policies', async () => {
  const sql = postgres(url, { max: 1, prepare: false })
  try {
    const rows = await sql<{
      db: string; current_role: string; table_owner: string
      rls_enabled: boolean; force_rls: boolean
      is_superuser: boolean; bypass_rls: boolean; policy_count: number
    }[]>`
      SELECT current_database() AS db,
        current_user AS current_role,
        pg_get_userbyid(c.relowner) AS table_owner,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS force_rls,
        r.rolsuper AS is_superuser,
        r.rolbypassrls AS bypass_rls,
        (SELECT count(*)::integer FROM pg_policies p
          WHERE p.schemaname='public' AND p.tablename='athlete_biometric_observations') AS policy_count
      FROM pg_class c JOIN pg_roles r ON r.rolname=current_user
      WHERE c.oid='public.athlete_biometric_observations'::regclass
    `
    assert.equal(rows.length, 1)
    const state = rows[0]
    assert.equal(state.db, 'kan646_biometric_disposable')
    assert.equal(state.rls_enabled, true)
    // In the dedicated single-owner disposable PG-0/PG-4 laboratory, the
    // migration role owns the table; RLS is not forced and no policy was
    // provisioned. These checks describe the current security *gap*, not
    // an authorization guarantee.
    assert.equal(state.current_role, state.table_owner)
    assert.equal(state.force_rls, false)
    assert.equal(state.policy_count, 0)
    assert.equal(state.is_superuser, true)
    assert.equal(state.bypass_rls, true)
  } finally { await sql.end() }
})
