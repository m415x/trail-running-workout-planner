import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')

test('KAN-646/T5 SQLite and PostgreSQL model the isolated, append-only self-declared observations', () => {
  for (const schema of ['db/schema.ts', 'db/supabase/schema.ts']) {
    const source = read(schema)
    assert.match(source, /athlete_biometric_observations/)
    assert.match(source, /supersedes_observation_id/)
    assert.match(source, /recorded_by_user_id/)
    assert.match(source, /observed_on/)
    assert.match(source, /recorded_at/)
    assert.match(source, /operation_key/)
    assert.match(source, /request_digest/)
  }
})

test('KAN-646/T5 canonical migration continues historical snapshots without weakening existing PG RLS', () => {
  for (const [root, previous, next] of [
    ['drizzle/sqlite', '0026', '0027'],
    ['drizzle/supabase', '0040', '0041'],
  ] as const) {
    const entries = JSON.parse(read(root + '/meta/_journal.json')).entries as {tag:string}[]
    const tag = entries.at(-1)?.tag
    assert.ok(tag?.startsWith(next + '_'), 'Expected latest migration ' + next)
    assert.equal(entries.at(-2)?.tag.startsWith(previous + '_'), true)
    const before = JSON.parse(read(root + '/meta/' + previous + '_snapshot.json'))
    const after = JSON.parse(read(root + '/meta/' + next + '_snapshot.json'))
    assert.equal(after.prevId, before.id)
    assert.ok(Object.keys(after.tables).some((key) => key.endsWith('athlete_biometric_observations')))
    const sql = read(root + '/' + tag + '.sql')
    assert.match(sql, /CREATE TABLE .athlete_biometric_observations./)
    assert.match(sql, /supersedes_observation_id/)
    assert.match(sql, /UNIQUE/i)
    assert.match(sql, /CHECK/i)
    if (root === 'drizzle/supabase') {
      assert.match(sql, /ALTER TABLE "athlete_biometric_observations" ENABLE ROW LEVEL SECURITY/)
      assert.doesNotMatch(sql, /DISABLE ROW LEVEL SECURITY/i)
      assert.doesNotMatch(sql, /ALTER TABLE "(?!athlete_biometric_observations")/)
      assert.equal(before.tables['public.session_generation_preferences'].isRLSEnabled, true)
      assert.deepEqual(after.tables['public.session_generation_preferences'], before.tables['public.session_generation_preferences'])
    }
  }
})
