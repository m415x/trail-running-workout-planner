import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-615 preserves PostgreSQL inbound athlete foreign keys', () => {
  const previous = JSON.parse(readFileSync(
    'drizzle/supabase/meta/0028_snapshot.json', 'utf8',
  ))
  const current = JSON.parse(readFileSync(
    'drizzle/supabase/meta/0029_snapshot.json', 'utf8',
  ))

  const incoming: string[] = []

  for (const [name, before] of Object.entries(previous.tables)) {
    if (name === 'public.athlete_profiles') continue

    const after = current.tables[name]
    assert.deepEqual(after, before, `Unexpected change in ${name}`)

    const table = before as {
      foreignKeys: Record<string, {
        tableTo: string
        columnsTo: string[]
      }>
    }

    for (const [key, fk] of Object.entries(table.foreignKeys ?? {})) {
      if (fk.tableTo !== 'athlete_profiles') continue

      assert.deepEqual(fk.columnsTo, ['id'])
      incoming.push(`${name}.${key}`)
    }
  }

  assert.equal(
    Object.keys(current.tables).length,
    Object.keys(previous.tables).length,
  )
  assert.equal(incoming.length, 12,
    `Expected twelve incoming FKs; found ${incoming.length}`,
  )
})

test('KAN-615 PostgreSQL backfill precedes unlinking and uses user FK', () => {
  const sql = readFileSync(
    'drizzle/supabase/0029_athlete_profile_identity.sql', 'utf8',
  )

  const backfill = sql.indexOf('UPDATE "athlete_profiles" AS a')
  const nullable = sql.indexOf('ALTER COLUMN "user_id" DROP NOT NULL')

  assert.ok(backfill >= 0, 'Missing administrative backfill')
  assert.ok(nullable > backfill, 'Backfill must precede unlinking')

  assert.match(sql, /FROM\s+"users"\s+AS\s+u/i)
  assert.match(sql, /a\."user_id"\s*=\s*u\."id"/i)

  for (const [destination, source] of [
    ['first_name', 'first_name'],
    ['last_name', 'last_name'],
    ['contact_email', 'email'],
  ]) {
    assert.ok(
      sql.includes(`COALESCE(a."${destination}", u."${source}")`),
      `Missing FK-scoped backfill for ${destination}`,
    )
  }

  assert.doesNotMatch(sql, /\bDROP TABLE\b|\bTRUNCATE\b|\bDELETE FROM\b/i)
})
