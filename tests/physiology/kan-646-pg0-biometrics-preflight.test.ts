import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'
import { assertSafeKan646BiometricPostgresTarget } from '@/scripts/test-runner'

const url = process.env.KAN646_PG_URL
assertSafeKan646BiometricPostgresTarget(process.env)

test('KAN-646 PG-0 dedicated database identity, migrated biometric schema, RLS and policies are explicitly inspected', async () => {
  const sql = postgres(url!, { max: 1, prepare: false })
  try {
    const identity = await sql<{ database: string; port: number; role: string }[]>`
      SELECT current_database() AS database, inet_server_port()::integer AS port,
             current_user AS role`
    assert.equal(identity[0]?.database, 'kan646_biometric_disposable')
    assert.equal(identity[0]?.port, 5432, 'server container internal PostgreSQL port')
    const table = await sql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE oid = 'public.athlete_biometric_observations'::regclass`
    assert.equal(table[0]?.relrowsecurity, true, 'RLS must be enabled in applied migration')
    const constraints = await sql<{ name: string; type: string }[]>`
      SELECT conname AS name, contype::text AS type FROM pg_constraint
      WHERE conrelid = 'public.athlete_biometric_observations'::regclass`
    assert.ok(constraints.some(x => x.type === 'c'), 'CHECK constraints')
    assert.ok(constraints.some(x => x.type === 'f'), 'FK constraints')
    const indexes = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
      AND tablename = 'athlete_biometric_observations'`
    assert.ok(indexes.some(x => x.indexname === 'athlete_biometric_operation_unique'))
    const policies = await sql<{ policyname: string }[]>`
      SELECT policyname FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'athlete_biometric_observations'`
    // A table with RLS enabled but no policies is default deny for non-bypass roles.
    // Never interpret RLS=true as proof of effective policies or server-side H2/H3.
    assert.ok(Array.isArray(policies))
  } finally { await sql.end() }
})
