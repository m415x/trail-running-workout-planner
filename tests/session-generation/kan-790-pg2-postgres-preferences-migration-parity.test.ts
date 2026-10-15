import assert from 'node:assert/strict'
import test from 'node:test'
import postgres from 'postgres'

/** Real, non-skippable PostgreSQL catalog acceptance for additive PG-2 parity. */
test('KAN-790 PG-2 session generation preferences physical PostgreSQL table', async () => {
  const url = process.env.KAN789_PG_URL
  assert.ok(url, 'KAN789_PG_URL is required; SKIP cannot prove parity')
  const target = new URL(url)
  assert.equal(target.hostname, '127.0.0.1')
  assert.equal(target.port, '55439')
  assert.equal(target.pathname, '/kan789_acceptance')
  const sql = postgres(url, { max: 1, prepare: false })
  try {
    assert.equal((await sql<{ name: string }[]>`SELECT current_database() AS name`)[0]?.name,
      'kan789_acceptance')
    const tables = await sql<{ enabled: boolean }[]>`
      SELECT c.relrowsecurity AS enabled FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'session_generation_preferences'
        AND c.relkind = 'r'`
    assert.equal(tables.length, 1, 'PostgreSQL table is missing after canonical migrations')
    assert.equal(tables[0]?.enabled, true, 'RLS required')
    const columns = await sql<{ column_name: string; data_type: string; is_nullable: string }[]>`
      SELECT column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'session_generation_preferences'
      ORDER BY ordinal_position`
    assert.deepEqual(Array.from(columns).map(c =>
      [c.column_name, c.data_type, c.is_nullable]), [
      ['id','text','NO'],
      ['group_training_plan_id','text','NO'],
      ['frequency_mode','text','NO'],
      ['fixed_sessions_per_week','integer','YES'],
      ['weekly_pattern','text','NO'],
      ['is_deleted','boolean','NO'],
      ['created_at','text','NO'],
      ['updated_at','text','NO'],
    ])
    const indexes = await sql<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'session_generation_preferences'`
    const unique = indexes.find(x =>
      x.indexname === 'session_generation_preferences_group_training_plan_unique')
    assert.ok(unique)
    assert.match(unique.indexdef, /UNIQUE INDEX/)
    const foreignKeys = await sql<{ definition: string }[]>`
      SELECT pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'session_generation_preferences' AND c.contype = 'f'`
    assert.equal(foreignKeys.length, 1)
    assert.match(foreignKeys[0].definition, /ON DELETE CASCADE/)
    assert.match(foreignKeys[0].definition, /group_training_plans/)
  } finally {
    await sql.end()
  }
})
